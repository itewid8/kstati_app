package expo.modules.kstatiwidget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.TypedValue
import android.util.Log
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.util.Calendar
import java.util.Locale
import java.util.TimeZone
import kotlin.math.floor
import kotlin.math.roundToInt

/**
 * Виджет «Кстати» в стиле приложения («Инструмент»): список в рамке 1.5 с шапкой (группа, сегодня — число в красном
 * квадрате), строки с полосой цвета человека, названием и временем Geist Mono справа, кнопка REC.
 * Рисуется разметкой Android (RemoteViews), а не картинкой: раскладку по настоящей рамке виджета делает рабочий стол.
 *
 * Данные пишет приложение (src/lib/widgetSync.ts, формат — src/lib/widgetData.ts) в папку приложения:
 *   widget.json        — { v: 2, at, dark, groups: [{ id, name }], items: [{ id, occ, g, title, date, time, until, c }] }
 *   widget-prefs.json  — { "default": настройки, "<id виджета>": настройки } — { mic, micTone, bg, opacity, text, time, head, headOpacity, groups }
 * Подписи времени и цвета считаются так же, как whenParts / widgetColors в widgetData.ts — менять вместе.
 * Прошедшие дела виджет отбрасывает сам и перерисовывается к началу ближайшего дела и в полночь.
 */
object KstatiWidget {
  const val ACTION_REFRESH = "expo.modules.kstatiwidget.REFRESH"
  private const val TAG = "KstatiWidget"
  private const val DATA_FILE = "widget.json"
  private const val PREFS_FILE = "widget-prefs.json"
  private const val PREFS_DEFAULT = "default"
  private const val SCHEME = "kstatiapp"
  private const val DAY_MS = 86_400_000L
  /** Наименьшая непрозрачность поверхности (прозрачность в настройках — до 80%) */
  private const val OPACITY_MIN = 0.0

  // Коды PendingIntent: открыть дела, запись, строки дел (у каждой строки свой адрес)
  private const val REQ_OPEN = 1
  private const val REQ_REC = 2
  private const val REQ_ITEM = 100

  /** Цвет в светлой и тёмной теме телефона: на Android 12+ система сама берёт нужный, без перерисовки */
  private data class Ink(val day: Int, val night: Int) {
    fun at(night: Boolean) = if (night) this.night else day
    fun alpha(a: Double) = Ink(withAlpha(day, a), withAlpha(night, a))
  }

  private data class Item(
    val id: String,
    val occ: String?,
    val group: String,
    val title: String,
    val date: String,
    val time: String?,
    val until: Long,
    val strip: List<Ink>,
    /** Сделано сегодня — зачёркнуто */
    val done: Boolean,
  )

  private data class Snapshot(val items: List<Item>, val dark: Boolean?, val groups: Map<String, String>)

  private data class Prefs(
    val mic: Boolean,
    val micTone: String,
    val bg: String,
    val opacity: Double,
    val text: String,
    val time: String,
    val head: String,
    /** Непрозрачность заливки шапки 0…1; null — у «авто» нет заливки, у светлой / тёмной — сплошная */
    val headOpacity: Double?,
    /** Группы, дела которых показывать; пусто — все мои */
    val groups: List<String>,
  )

  /** Палитра приложения (src/ui/tokens.ts) */
  private class Palette(val bg: Int, val panel: Int, val border: Int, val hair: Int, val text: Int, val muted: Int, val red: Int)

  /** Цвета раскладок (как faceColors в src/lib/widgetData.ts); поверхность и свечение — без альфы, прозрачность отдельно */
  private class Colors(
    val card: Ink,
    val cardAlpha: Int,
    val text: Ink,
    val muted: Ink,
    val hair: Ink,
    val today: Ink,
    val time: Ink,
    val day: Ink,
    val headBg: Ink?,
    val headAlpha: Int,
    val headInk: Ink,
    val headMuted: Ink,
    val recFill: Ink,
    val recBorder: Ink,
    val recDot: Ink,
    val recGlowAlpha: Int,
    val recInk: Ink,
    val showMic: Boolean,
  )

  private val LIGHT = Palette(
    bg = 0xFFE7E6E1.toInt(),
    panel = 0xFFF4F3EF.toInt(),
    border = 0xFF161616.toInt(),
    hair = 0xFFCFCEC8.toInt(),
    text = 0xFF111111.toInt(),
    muted = 0xFF5E5E58.toInt(),
    red = 0xFFE0281E.toInt(),
  )
  private val DARK = Palette(
    bg = 0xFF0B0B0B.toInt(),
    panel = 0xFF151515.toInt(),
    border = 0xFF2E2E2E.toInt(),
    hair = 0xFF222222.toInt(),
    text = 0xFFF2F2F0.toInt(),
    muted = 0xFF7C7C78.toInt(),
    red = 0xFFFF3B30.toInt(),
  )
  /** Белые цифры в красном квадрате «сегодня» — как в C-Week */
  private val TODAY_INK = 0xFFFFFFFF.toInt()

  /**
   * Раскладки (макеты C-WidgetHome, C-WidgetLarge) и размер (dp), с которого каждая подходит:
   *   MIC 1×1 — только REC; NEXT 2×1 — ближайшее дело и REC; STACK 2×2 — шапка и дела «название / день · время»;
   *   DAYS 4×2 и больше — шапка и дела по дням.
   */
  private enum class Kind { MIC, NEXT, STACK, DAYS }

  private class Layout(val kind: Kind, val w: Float, val h: Float)

  private val LAYOUTS = listOf(
    Layout(Kind.MIC, w = 40f, h = 40f),
    Layout(Kind.NEXT, w = 110f, h = 40f),
    Layout(Kind.STACK, w = 110f, h = 110f),
    Layout(Kind.DAYS, w = 250f, h = 110f),
  )

  /** Высоты (dp) из макета: шапка 40 без линии снизу, подпись дня 16 */
  private const val HEAD_H = 40f
  private const val DAY_H = 16f
  /** Строка дела — 20 без разделителей (2×2, 4×2, 4×4); под шапкой 2×2 — отступ 4 */
  private const val ROW_H = 20f
  private const val STACK_GAP = 4f

  private val WD = arrayOf("ПН", "ВТ", "СР", "ЧТ", "ПТ", "СБ", "ВС")
  private val MON = arrayOf("ЯНВ", "ФЕВ", "МАР", "АПР", "МАЙ", "ИЮН", "ИЮЛ", "АВГ", "СЕН", "ОКТ", "НОЯ", "ДЕК")

  fun updateAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    val ids = manager.getAppWidgetIds(ComponentName(context, KstatiWidgetProvider::class.java))
    val snap = readSnapshot(context)
    val prefs = readJson(context, PREFS_FILE)
    for (id in ids) draw(context, manager, id, snap, prefs)
    scheduleNext(context, snap, ids.isNotEmpty())
  }

  fun update(context: Context, widgetId: Int) {
    val snap = readSnapshot(context)
    draw(context, AppWidgetManager.getInstance(context), widgetId, snap, readJson(context, PREFS_FILE))
    scheduleNext(context, snap, true)
  }

  fun cancelRefresh(context: Context) {
    context.getSystemService(AlarmManager::class.java)?.cancel(refreshIntent(context))
  }

  /** Виджеты убрали с рабочего стола — их настройки больше не нужны */
  fun forget(context: Context, widgetIds: IntArray) {
    try {
      val all = readJson(context, PREFS_FILE) ?: return
      var changed = false
      for (id in widgetIds) if (all.remove(id.toString()) != null) changed = true
      if (changed) File(context.filesDir, PREFS_FILE).writeText(all.toString())
    } catch (e: Exception) {
      Log.w(TAG, "Настройки виджета не удалены", e)
    }
  }

  /* ---------- рисование ---------- */

  private fun draw(context: Context, manager: AppWidgetManager, widgetId: Int, snap: Snapshot?, prefsAll: JSONObject?) {
    try {
      val prefs = readPrefs(prefsAll, widgetId)
      val night = isNight(context)
      val colors = colors(snap?.dark, prefs)
      val now = System.currentTimeMillis()
      val options = manager.getAppWidgetOptions(widgetId)
      val views = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        // Своя раскладка на каждый размер, который сообщил рабочий стол (обычно вертикальный и горизонтальный экран):
        // число строк считается по настоящей высоте. Размеров нет — раскладки по порогам, система выберет сама
        val sizes = reportedSizes(options)
        if (sizes.isNotEmpty()) {
          RemoteViews(sizes.associateWith { build(context, bestFit(it), snap, prefs, colors, now, it, night) })
        } else {
          val size = reportedSize(context, options)
          RemoteViews(LAYOUTS.associate { SizeF(it.w, it.h) to build(context, it, snap, prefs, colors, now, size, night) })
        }
      } else {
        val size = reportedSize(context, options)
        build(context, bestFit(size), snap, prefs, colors, now, size, night)
      }
      manager.updateAppWidget(widgetId, views)
    } catch (e: Exception) {
      Log.w(TAG, "Виджет не нарисован", e)
    }
  }

  private fun build(
    context: Context,
    layout: Layout,
    snap: Snapshot?,
    p: Prefs,
    c: Colors,
    now: Long,
    size: SizeF,
    night: Boolean,
  ): RemoteViews {
    // Без REC раскладка «только REC» не нужна — показываем ближайшее дело
    val kind = if (layout.kind == Kind.MIC && !c.showMic) Kind.NEXT else layout.kind
    val v = RemoteViews(
      context.packageName,
      when (kind) {
        Kind.MIC -> R.layout.kstati_widget_mic
        Kind.NEXT -> R.layout.kstati_widget_row
        Kind.STACK, Kind.DAYS -> R.layout.kstati_widget_tall
      },
    )
    v.ink(R.id.kstati_bg, "setColorFilter", c.card, night)
    v.setInt(R.id.kstati_bg, "setImageAlpha", c.cardAlpha)
    v.setOnClickPendingIntent(android.R.id.background, open(context, "$SCHEME://tasks", REQ_OPEN))

    val groups = snap?.groups ?: emptyMap()
    // Группы, из которых вышли или которые удалили, пропускаем; не осталось ни одной — показываем все
    val chosen = p.groups.filter { groups.containsKey(it) }.toSet()
    val today = localIso(now)
    val items = snap?.items ?: emptyList()

    when (kind) {
      Kind.MIC -> rec(context, v, c, night, label = true)
      Kind.NEXT -> {
        val x = visible(items, now, 1, chosen).firstOrNull()
        if (x == null) {
          v.setTextViewText(R.id.kstati_title, context.getString(R.string.kstati_widget_empty))
          v.ink(R.id.kstati_title, "setTextColor", c.muted, night)
          v.setViewVisibility(R.id.kstati_when, View.GONE)
          v.setViewVisibility(R.id.kstati_strip_a, View.INVISIBLE)
          v.setViewVisibility(R.id.kstati_strip_b, View.GONE)
        } else {
          v.setViewVisibility(R.id.kstati_when, View.VISIBLE)
          v.setViewVisibility(R.id.kstati_strip_a, View.VISIBLE)
          strip(v, x, night)
          v.setTextViewText(R.id.kstati_title, x.title)
          v.ink(R.id.kstati_title, "setTextColor", c.text, night)
          v.setTextViewText(R.id.kstati_when, faceWhen(x.date, x.time, today))
          v.ink(R.id.kstati_when, "setTextColor", c.day, night)
          v.setOnClickPendingIntent(R.id.kstati_row, open(context, itemUri(x), REQ_ITEM))
        }
        if (c.showMic) {
          v.setViewVisibility(R.id.kstati_rec_box, View.VISIBLE)
          rec(context, v, c, night, label = true)
        } else {
          v.setViewVisibility(R.id.kstati_rec_box, View.GONE)
        }
      }
      Kind.STACK, Kind.DAYS -> {
        header(context, v, groups, chosen, today, c, night)
        fillList(context, v, kind, items, chosen, now, today, size, c, night)
      }
    }
    return v
  }

  /**
   * Кнопка REC — капсула «● REC» (макет C-WidgetRec, D): непрозрачная заливка, мягкий контур цвета разделителя.
   * label = false — без подписи, поля 7 (круглая, шапка 2×2). Видимость задаём явно: рабочий стол применяет
   * команды к уже показанному виду
   */
  private fun rec(context: Context, v: RemoteViews, c: Colors, night: Boolean, label: Boolean, small: Boolean = false) {
    v.setViewVisibility(R.id.kstati_rec, View.VISIBLE)
    v.ink(R.id.kstati_rec_fill, "setColorFilter", c.recFill, night)
    v.ink(R.id.kstati_rec_stroke, "setColorFilter", c.recBorder, night)
    v.ink(R.id.kstati_rec_dot, "setColorFilter", c.recDot, night)
    v.ink(R.id.kstati_rec_glow, "setColorFilter", c.recDot, night)
    v.setInt(R.id.kstati_rec_glow, "setImageAlpha", c.recGlowAlpha)
    v.setViewVisibility(R.id.kstati_rec_label, if (label) View.VISIBLE else View.GONE)
    v.ink(R.id.kstati_rec_label, "setTextColor", c.recInk, night)
    val d = context.resources.displayMetrics.density
    // Рамка точки 15 (со свечением) — поле слева на 3 меньше, чем в макете при точке 9 (7/8/10 → 4/5/7)
    val (pl, pr) = when {
      !label -> 4 to 4
      small -> 5 to 9
      else -> 7 to 11
    }
    v.setViewPadding(R.id.kstati_rec_content, (pl * d).roundToInt(), 0, (pr * d).roundToInt(), 0)
    v.setOnClickPendingIntent(R.id.kstati_rec, open(context, "$SCHEME://record", REQ_REC))
  }

  /** Шапка: группы (или «ВСЕ ГРУППЫ»), день недели, число в красном квадрате, кружок REC справа */
  private fun header(
    context: Context,
    v: RemoteViews,
    groups: Map<String, String>,
    chosen: Set<String>,
    today: String,
    c: Colors,
    night: Boolean,
  ) {
    // Подложка — картинка со скруглёнными верхними углами (kstati_head_bg), а не фон строки
    if (c.headBg != null) {
      v.setViewVisibility(R.id.kstati_header_bg, View.VISIBLE)
      v.ink(R.id.kstati_header_bg, "setColorFilter", c.headBg, night)
      v.setInt(R.id.kstati_header_bg, "setImageAlpha", c.headAlpha)
    } else {
      v.setViewVisibility(R.id.kstati_header_bg, View.GONE)
    }
    val label = if (chosen.isEmpty()) "ВСЕ ГРУППЫ" else chosen.mapNotNull { groups[it] }.joinToString(" · ").uppercase(Locale("ru", "RU"))
    v.setTextViewText(R.id.kstati_header_label, label)
    v.ink(R.id.kstati_header_label, "setTextColor", c.headInk, night)
    v.setTextViewText(R.id.kstati_header_weekday, WD[weekdayIndex(today)])
    v.ink(R.id.kstati_header_weekday, "setTextColor", c.headMuted, night)
    v.setTextViewText(R.id.kstati_header_day, today.substring(8, 10))
    v.ink(R.id.kstati_header_day, "setBackgroundColor", c.today, night)
    // REC в шапке — капсула D без подписи, только кружок (макет C-WidgetRec)
    if (c.showMic) {
      v.setViewVisibility(R.id.kstati_header_rec, View.VISIBLE)
      v.setViewVisibility(R.id.kstati_header_end, View.GONE)
      rec(context, v, c, night, label = false, small = true)
    } else {
      v.setViewVisibility(R.id.kstati_header_rec, View.GONE)
      v.setViewVisibility(R.id.kstati_header_end, View.VISIBLE)
    }
  }

  /** Дела: 2×2 — строки «название / день · время», 4×2 и больше — по дням. Не влезли — низ гаснет */
  private fun fillList(
    context: Context,
    v: RemoteViews,
    kind: Kind,
    items: List<Item>,
    chosen: Set<String>,
    now: Long,
    today: String,
    size: SizeF,
    c: Colors,
    night: Boolean,
  ) {
    v.removeAllViews(R.id.kstati_list)
    // Шрифты виджета в dp — от системного масштаба шрифта строки не растут
    // Высоту знаем со слов рабочего стола (бывает больше настоящей на несколько процентов) — считаем с запасом
    var room = size.height * 0.96f - HEAD_H - (if (kind == Kind.STACK) STACK_GAP else 0f)
    val rows = visible(items, now, 40, chosen)
    if (rows.isEmpty()) {
      val empty = RemoteViews(context.packageName, R.layout.kstati_row_empty)
      empty.ink(R.id.kstati_empty, "setTextColor", c.muted, night)
      v.addView(R.id.kstati_list, empty)
      v.setViewVisibility(R.id.kstati_fade, View.GONE)
      return
    }
    if (kind == Kind.STACK) v.addView(R.id.kstati_list, RemoteViews(context.packageName, R.layout.kstati_gap))
    var shown = 0
    var lastDate: String? = null
    for ((i, x) in rows.withIndex()) {
      val newDay = kind == Kind.DAYS && x.date != lastDate
      val need = ROW_H + (if (newDay) DAY_H else 0f)
      if (need > room) break
      if (newDay) {
        val d = RemoteViews(context.packageName, R.layout.kstati_day)
        d.setTextViewText(R.id.kstati_day_label, faceDayLabel(x.date, today))
        d.ink(R.id.kstati_day_label, "setTextColor", c.muted, night)
        v.addView(R.id.kstati_list, d)
        lastDate = x.date
      }
      // Одна строка на дело: 2×2 — справа день (сегодня — время) 10 приглушённо, по дням — время 12
      val row = RemoteViews(context.packageName, R.layout.kstati_row_inline)
      row.ink(R.id.kstati_divider, "setBackgroundColor", c.hair, night)
      strip(row, x, night)
      row.setTextViewText(R.id.kstati_title, x.title)
      row.ink(R.id.kstati_title, "setTextColor", if (x.done) c.muted else c.text, night)
      if (x.done) row.setInt(R.id.kstati_title, "setPaintFlags", android.graphics.Paint.STRIKE_THRU_TEXT_FLAG or android.graphics.Paint.ANTI_ALIAS_FLAG)
      if (kind == Kind.DAYS) {
        row.setTextViewText(R.id.kstati_time, x.time ?: "—")
        row.ink(R.id.kstati_time, "setTextColor", c.time, night)
      } else {
        row.setTextViewText(R.id.kstati_time, faceWhen(x.date, x.time, today, short = true))
        row.setTextViewTextSize(R.id.kstati_time, TypedValue.COMPLEX_UNIT_DIP, 8.5f)
        row.ink(R.id.kstati_time, "setTextColor", c.day, night)
      }
      row.setOnClickPendingIntent(R.id.kstati_row, open(context, itemUri(x), REQ_ITEM + i))
      v.addView(R.id.kstati_list, row)
      room -= need
      shown++
    }
    val more = shown < rows.size && kind == Kind.DAYS
    v.setViewVisibility(R.id.kstati_fade, if (more) View.VISIBLE else View.GONE)
    if (more) {
      v.ink(R.id.kstati_fade, "setColorFilter", c.card, night)
      v.setInt(R.id.kstati_fade, "setImageAlpha", c.cardAlpha)
    }
  }

  private fun strip(row: RemoteViews, x: Item, night: Boolean) {
    val a = x.strip.getOrNull(0)
    val b = x.strip.getOrNull(1)
    if (a != null) row.ink(R.id.kstati_strip_a, "setBackgroundColor", a, night)
    if (b != null) {
      row.setViewVisibility(R.id.kstati_strip_b, View.VISIBLE)
      row.ink(R.id.kstati_strip_b, "setBackgroundColor", b, night)
    } else {
      row.setViewVisibility(R.id.kstati_strip_b, View.GONE)
    }
  }

  /** kstatiapp://widget/open?id=…&occ=… — экран app/widget/open.tsx откроет дело (или план) */
  private fun itemUri(x: Item): String {
    val b = Uri.Builder().scheme(SCHEME).authority("widget").appendPath("open").appendQueryParameter("id", x.id)
    if (x.occ != null) b.appendQueryParameter("occ", x.occ)
    return b.build().toString()
  }

  /** Как в макетах: от 250×110 — по дням, от 110×110 — 2×2, от 110 в ширину — 2×1, иначе — только REC */
  private fun bestFit(size: SizeF): Layout {
    val w = size.width + 0.5f
    val h = size.height + 0.5f
    return when {
      w >= 250f && h >= 110f -> LAYOUTS[3]
      w >= 110f && h >= 110f -> LAYOUTS[2]
      w >= 110f -> LAYOUTS[1]
      else -> LAYOUTS[0]
    }
  }

  /** Все размеры (dp), которые сообщил рабочий стол (Android 12+), без повторов и пустых */
  @Suppress("DEPRECATION")
  private fun reportedSizes(options: Bundle): List<SizeF> {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return emptyList()
    val sizes = options.getParcelableArrayList<SizeF>(AppWidgetManager.OPTION_APPWIDGET_SIZES) ?: return emptyList()
    return sizes.filter { it.width > 0f && it.height > 0f }.distinct().take(16)
  }

  /** Размер виджета (dp) со слов рабочего стола для текущей ориентации экрана */
  private fun reportedSize(context: Context, options: Bundle): SizeF {
    val portrait = context.resources.configuration.orientation != Configuration.ORIENTATION_LANDSCAPE
    val sizes = reportedSizes(options)
    if (sizes.isNotEmpty()) {
      // Обычно два размера: для вертикального экрана (уже и выше) и для горизонтального
      return if (portrait) sizes.minBy { it.width / it.height } else sizes.maxBy { it.width / it.height }
    }
    val w = options.getInt(if (portrait) AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH else AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH)
    val h = options.getInt(if (portrait) AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT else AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT)
    return SizeF(if (w > 0) w.toFloat() else 180f, if (h > 0) h.toFloat() else 110f)
  }

  private fun open(context: Context, uri: String, code: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /** Цвет с учётом темы: Android 12+ — пара цветов, система выбирает по теме сама; раньше — по теме сейчас */
  private fun RemoteViews.ink(id: Int, method: String, c: Ink, night: Boolean) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      setColorInt(id, method, c.day, c.night)
    } else {
      setInt(id, method, c.at(night))
    }
  }

  /* ---------- цвета (как widgetColors в src/lib/widgetData.ts) ---------- */

  /**
   * «Как в теме» — тема приложения, а если там «система» — тема телефона (пара: светлая тема телефона / тёмная).
   * Фон «светлый» — светлая палитра; названия и время «светлые» — светлые буквы (из тёмной палитры);
   * REC «светлая» — светлая кнопка. Время «как в теме» — цвет текста, день перед ним — приглушённый.
   * Непрозрачность — у подложки и заливки списка; рамки, шапка и буквы остаются чёткими
   */
  private fun colors(dark: Boolean?, p: Prefs): Colors {
    val auto = Pair(if (dark == true) DARK else LIGHT, if (dark == false) LIGHT else DARK)
    fun look(tone: String): Pair<Palette, Palette> = when (tone) {
      "light" -> Pair(LIGHT, LIGHT)
      "dark" -> Pair(DARK, DARK)
      else -> auto
    }
    val bg = look(p.bg)
    fun ink(tone: String): Pair<Palette, Palette> = when (tone) {
      "light" -> Pair(DARK, DARK)
      "dark" -> Pair(LIGHT, LIGHT)
      else -> bg
    }
    val rec = look(p.micTone)
    val time = ink(p.time)
    val head = if (p.head == "auto") null else look(p.head)
    val headFill = (p.headOpacity ?: if (head == null) 0.0 else 1.0).coerceIn(0.0, 1.0)
    fun of(set: Pair<Palette, Palette>, f: (Palette) -> Int) = Ink(f(set.first), f(set.second))
    val recDark = p.micTone == "dark" || (p.micTone == "auto" && dark == true)
    return Colors(
      card = of(bg) { it.panel },
      cardAlpha = (p.opacity.coerceIn(OPACITY_MIN, 1.0) * 255).roundToInt(),
      text = of(ink(p.text)) { it.text },
      muted = of(bg) { it.muted },
      hair = of(bg) { it.hair },
      today = of(bg) { it.red },
      time = of(time) { it.text },
      day = if (p.time == "auto") of(bg) { it.muted } else of(time) { it.text },
      headBg = if (headFill > 0.0) of(head ?: bg) { it.panel } else null,
      headAlpha = (headFill * 255).roundToInt(),
      headInk = if (head != null) of(head) { it.text } else of(ink(p.text)) { it.text },
      headMuted = if (head != null) of(head) { it.muted } else of(bg) { it.muted },
      recFill = of(rec) { it.panel },
      recBorder = of(rec) { it.hair },
      recDot = of(rec) { it.red },
      recGlowAlpha = ((if (recDark) 0.22 else 0.18) * 255).roundToInt(),
      recInk = of(rec) { it.text },
      showMic = p.mic,
    )
  }

  private fun withAlpha(color: Int, a: Double): Int {
    val alpha = (a.coerceIn(0.0, 1.0) * 255).roundToInt()
    return (color and 0x00FFFFFF) or (alpha shl 24)
  }

  private fun isNight(context: Context) =
    (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

  /* ---------- дела и подписи (как visibleAt / whenParts в widgetData.ts) ---------- */

  /** Первые n ещё не прошедших дел группы (или всех); у серии — только ближайший раз */
  private fun visible(items: List<Item>, now: Long, n: Int, groups: Set<String>): List<Item> {
    val seen = HashSet<String>()
    val out = ArrayList<Item>()
    for (x in items) {
      if (out.size >= n) break
      if (x.until <= now || (groups.isNotEmpty() && x.group !in groups) || !seen.add(x.id)) continue
      out.add(x)
    }
    return out
  }

  /**
   * Подпись дня (приглушённая, может не быть) и время справа:
   * сегодня — «19:00» / «—»; завтра — «ЗАВТРА» + время или просто «ЗАВТРА»; до 6 дней — «СБ 10»; дальше — «17 ОКТ»
   */
  private fun whenParts(date: String, time: String?, today: String): Pair<String?, String> {
    val diff = dayNo(date) - dayNo(today)
    if (diff <= 0L) return Pair(null, time ?: "—")
    val day = when {
      diff == 1L -> "ЗАВТРА"
      diff <= 6L -> "${WD[weekdayIndex(date)]} ${date.substring(8, 10)}"
      else -> "${date.substring(8, 10).toInt()} ${MON[(date.substring(5, 7).toInt() - 1).coerceIn(0, 11)]}"
    }
    return if (time != null) Pair(day, time) else Pair(null, day)
  }

  /** Подпись под названием (2×2, 2×1) — как faceWhen в widgetData.ts: «18:00», «ЗАВТРА · 10:00», «СР 28 · 18:00», «1 НОЯ» */
  private fun faceWhen(date: String, time: String?, today: String, short: Boolean = false): String {
    val diff = dayNo(date) - dayNo(today)
    val d = date.substring(8, 10).toInt()
    val m = date.substring(5, 7).toInt()
    val day = when {
      diff <= 0L -> null
      diff == 1L -> "ЗАВТРА"
      diff <= 6L -> "${WD[weekdayIndex(date)]} ${"%02d".format(d)}"
      else -> "$d ${MON[m - 1]}"
    }
    if (day == null) return time ?: "СЕГОДНЯ"
    // short — строка 2×2: на другие дни только день
    return if (time != null && !short) "$day · $time" else day
  }

  /** Подпись дня (4×2, 4×4) — как faceDayLabel: «СБ 24 · СЕГОДНЯ», «ВС 25 · ЗАВТРА», «СР 28», «ВС 1 НОЯ» */
  private fun faceDayLabel(date: String, today: String): String {
    val diff = dayNo(date) - dayNo(today)
    val wd = WD[weekdayIndex(date)]
    val d = date.substring(8, 10).toInt()
    val m = date.substring(5, 7).toInt()
    return when {
      diff == 0L -> "$wd ${"%02d".format(d)} · СЕГОДНЯ"
      diff == 1L -> "$wd ${"%02d".format(d)} · ЗАВТРА"
      diff in 2L..6L -> "$wd ${"%02d".format(d)}"
      else -> "$wd $d ${MON[m - 1]}"
    }
  }

  private fun parts(iso: String): IntArray {
    val p = iso.split("-")
    return intArrayOf(p.getOrNull(0)?.toIntOrNull() ?: 1970, p.getOrNull(1)?.toIntOrNull() ?: 1, p.getOrNull(2)?.toIntOrNull() ?: 1)
  }

  private fun utcDay(iso: String): Calendar {
    val p = parts(iso)
    return Calendar.getInstance(TimeZone.getTimeZone("UTC")).apply {
      clear()
      set(p[0], p[1] - 1, p[2])
    }
  }

  /** Номер дня от 1970-01-01 — разница дат без часовых поясов и перехода на летнее время */
  private fun dayNo(iso: String): Long = utcDay(iso).timeInMillis / DAY_MS

  /** 0 = пн … 6 = вс */
  private fun weekdayIndex(iso: String): Int = (utcDay(iso).get(Calendar.DAY_OF_WEEK) + 5) % 7

  private fun localIso(ms: Long): String {
    val c = Calendar.getInstance().apply { timeInMillis = ms }
    return String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))
  }

  /* ---------- перерисовка по времени ---------- */

  /** Будильник (неточный, без пробуждения телефона) к началу ближайшего дела и к полуночи — чтобы прошедшее исчезало */
  private fun scheduleNext(context: Context, snap: Snapshot?, any: Boolean) {
    val alarms = context.getSystemService(AlarmManager::class.java) ?: return
    val pi = refreshIntent(context)
    alarms.cancel(pi)
    if (!any) return
    val now = System.currentTimeMillis()
    val midnight = Calendar.getInstance().apply {
      timeInMillis = now
      add(Calendar.DAY_OF_MONTH, 1)
      set(Calendar.HOUR_OF_DAY, 0)
      set(Calendar.MINUTE, 0)
      set(Calendar.SECOND, 5)
      set(Calendar.MILLISECOND, 0)
    }.timeInMillis
    val next = snap?.items?.asSequence()?.map { it.until }?.filter { it > now }?.minOrNull()
    val at = if (next != null && next < midnight) next + 1000 else midnight
    alarms.set(AlarmManager.RTC, at, pi)
  }

  private fun refreshIntent(context: Context): PendingIntent =
    PendingIntent.getBroadcast(
      context,
      0,
      Intent(context, KstatiWidgetProvider::class.java).setAction(ACTION_REFRESH),
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

  /* ---------- файлы ---------- */

  private fun readJson(context: Context, name: String): JSONObject? = try {
    val f = File(context.filesDir, name)
    if (f.exists()) JSONObject(f.readText()) else null
  } catch (e: Exception) {
    null
  }

  private fun JSONObject.str(key: String): String? = if (has(key) && !isNull(key)) optString(key) else null

  private fun color(hex: String?, fallback: Int): Int = try {
    if (hex == null) fallback else Color.parseColor(hex)
  } catch (e: IllegalArgumentException) {
    fallback
  }

  /** [["#светлая", "#тёмная"], …] — цвет полосы каждого человека в обеих темах */
  private fun strips(arr: JSONArray?): List<Ink> {
    if (arr == null) return emptyList()
    val out = ArrayList<Ink>()
    for (i in 0 until minOf(arr.length(), 2)) {
      val pair = arr.optJSONArray(i) ?: continue
      val day = color(pair.optString(0, ""), LIGHT.muted)
      out.add(Ink(day, color(pair.optString(1, ""), day)))
    }
    return out
  }

  private fun readSnapshot(context: Context): Snapshot? {
    val o = readJson(context, DATA_FILE) ?: return null
    val items = ArrayList<Item>()
    val arr = o.optJSONArray("items")
    if (arr != null) {
      for (i in 0 until arr.length()) {
        val x = arr.optJSONObject(i) ?: continue
        val date = x.str("date") ?: continue
        items.add(
          Item(
            id = x.optString("id"),
            occ = x.str("occ"),
            group = x.optString("g"),
            title = x.optString("title"),
            date = date,
            time = x.str("time"),
            until = x.optLong("until"),
            strip = strips(x.optJSONArray("c")),
            done = x.optBoolean("d", false),
          ),
        )
      }
    }
    val groups = LinkedHashMap<String, String>()
    val garr = o.optJSONArray("groups")
    if (garr != null) {
      for (i in 0 until garr.length()) {
        val g = garr.optJSONObject(i) ?: continue
        groups[g.optString("id")] = g.optString("name")
      }
    }
    val dark = if (o.has("dark") && !o.isNull("dark")) o.optBoolean("dark") else null
    return Snapshot(items, dark, groups)
  }

  /** Настройки виджета: свои → общие («default», экран в приложении) → по умолчанию */
  private fun readPrefs(all: JSONObject?, widgetId: Int): Prefs {
    val p = all?.optJSONObject(widgetId.toString()) ?: all?.optJSONObject(PREFS_DEFAULT)
    fun tone(key: String): String = when (val t = p?.optString(key, "auto")) {
      "light", "dark" -> t
      else -> "auto"
    }
    return Prefs(
      mic = p?.optBoolean("mic", true) ?: true,
      micTone = tone("micTone"),
      bg = tone("bg"),
      opacity = (p?.optDouble("opacity", 1.0) ?: 1.0).let { if (it.isNaN()) 1.0 else it.coerceIn(0.0, 1.0) },
      text = tone("text"),
      time = tone("time"),
      head = tone("head"),
      headOpacity = p?.takeIf { it.has("headOpacity") && !it.isNull("headOpacity") }?.optDouble("headOpacity")?.takeIf { !it.isNaN() }?.coerceIn(0.0, 1.0),
      groups = run {
        val arr = p?.optJSONArray("groups")
        if (arr != null) (0 until arr.length()).mapNotNull { arr.optString(it).takeIf { s -> s.isNotEmpty() } }
        else listOfNotNull(p?.str("group")?.takeIf { it.isNotEmpty() })
      },
    )
  }
}
