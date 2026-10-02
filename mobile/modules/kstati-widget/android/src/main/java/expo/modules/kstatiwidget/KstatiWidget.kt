package expo.modules.kstatiwidget

import android.app.AlarmManager
import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.util.SizeF
import android.view.View
import android.widget.RemoteViews
import org.json.JSONObject
import java.io.File
import java.util.Calendar
import java.util.Locale
import kotlin.math.floor
import kotlin.math.roundToInt

/**
 * Виджет «Кстати»: ближайшие дела и микрофон. Рисуется обычной разметкой Android (RemoteViews),
 * а не картинкой: раскладку по настоящей рамке виджета делает сам рабочий стол, поэтому фон,
 * скругление и микрофон всегда точно по краям, какой бы размер рабочий стол ни сообщил.
 *
 * Данные пишет приложение (JS) в папку приложения:
 *   widget.json        — { items: [{ id, title, date, time, until }], dark }
 *   widget-prefs.json  — { "<id виджета>": { mic, opacity, bg, text, time, micTone } }
 * Прошедшие дела виджет отбрасывает сам и перерисовывается к началу ближайшего дела и в полночь.
 */
object KstatiWidget {
  const val ACTION_REFRESH = "expo.modules.kstatiwidget.REFRESH"

  private data class Item(val id: String, val title: String, val date: String?, val time: String?, val until: Long)
  private data class Snapshot(val items: List<Item>, val dark: Boolean?)
  private data class Prefs(val mic: Boolean, val opacity: Double, val bg: String, val text: String, val time: String, val micTone: String)
  private data class Colors(val bg: Int, val alpha: Int, val text: Int, val time: Int, val mic: Int, val onMic: Int, val showMic: Boolean)
  private class Palette(val bg: Int, val text: Int, val muted: Int, val mic: Int, val onMic: Int)

  // Те же цвета, что в приложении (src/widget/data.ts)
  private val DARK = Palette(0xFF1E1E1E.toInt(), 0xFFE6E6E6.toInt(), 0xFF8B8B8B.toInt(), 0xFFE6E6E6.toInt(), 0xFF1E1E1E.toInt())
  private val LIGHT = Palette(0xFFFFFFFF.toInt(), 0xFF1A1A1A.toInt(), 0xFF6B6B6B.toInt(), 0xFF1A1A1A.toInt(), 0xFFFFFFFF.toInt())

  private enum class Kind { MIC, ROW, TALL }

  /**
   * Раскладки и размер (dp), начиная с которого каждая подходит. На Android 12+ рабочий стол сам
   * выбирает ту, что ближе всего к настоящему размеру виджета (из тех, что помещаются).
   *   только микрофон · дела слева и микрофон справа · дела сверху и микрофон снизу;
   *   inline — «время  название» в одну строку (если ширины хватает), иначе название, под ним время.
   */
  private class Layout(val kind: Kind, val inline: Boolean, val w: Float, val h: Float)

  private val LAYOUTS = listOf(
    Layout(Kind.MIC, false, 40f, 40f),
    Layout(Kind.ROW, false, 110f, 40f),
    Layout(Kind.ROW, true, 180f, 40f),
    Layout(Kind.TALL, false, 110f, 110f),
    Layout(Kind.TALL, true, 180f, 110f),
    Layout(Kind.ROW, true, 300f, 110f),
    Layout(Kind.TALL, true, 300f, 250f),
  )

  private val WD = arrayOf("вс", "пн", "вт", "ср", "чт", "пт", "сб")
  private val MON = arrayOf("янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек")

  fun updateAll(context: Context) {
    val manager = AppWidgetManager.getInstance(context)
    val ids = manager.getAppWidgetIds(ComponentName(context, KstatiWidgetProvider::class.java))
    val snap = readSnapshot(context)
    for (id in ids) draw(context, manager, id, snap)
    scheduleNext(context, snap, ids.isNotEmpty())
  }

  fun update(context: Context, widgetId: Int) {
    val snap = readSnapshot(context)
    draw(context, AppWidgetManager.getInstance(context), widgetId, snap)
    scheduleNext(context, snap, true)
  }

  fun cancelRefresh(context: Context) {
    context.getSystemService(AlarmManager::class.java)?.cancel(refreshIntent(context))
  }

  /* ---------- рисование ---------- */

  private fun draw(context: Context, manager: AppWidgetManager, widgetId: Int, snap: Snapshot?) {
    try {
      val prefs = readPrefs(context, widgetId)
      val dark = snap?.dark ?: isNight(context)
      val colors = colors(dark, prefs)
      val items = snap?.items ?: emptyList()
      val now = System.currentTimeMillis()
      val size = reportedSize(context, manager.getAppWidgetOptions(widgetId))
      val views = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        RemoteViews(LAYOUTS.associate { SizeF(it.w, it.h) to build(context, it, items, now, colors, size) })
      } else {
        build(context, bestFit(size), items, now, colors, size)
      }
      manager.updateAppWidget(widgetId, views)
    } catch (e: Exception) {
      android.util.Log.w("KstatiWidget", "Виджет не нарисован", e)
    }
  }

  private fun build(context: Context, layout: Layout, items: List<Item>, now: Long, c: Colors, size: SizeF): RemoteViews {
    // Без микрофона «только микрофон» не нужен — показываем дела
    val kind = if (layout.kind == Kind.MIC && !c.showMic) Kind.ROW else layout.kind
    val res = when (kind) {
      Kind.MIC -> R.layout.kstati_widget_mic
      Kind.ROW -> R.layout.kstati_widget_row
      Kind.TALL -> R.layout.kstati_widget_tall
    }
    val v = RemoteViews(context.packageName, res)

    v.setInt(R.id.kstati_card, "setColorFilter", c.bg)
    v.setInt(R.id.kstati_card, "setImageAlpha", c.alpha)
    v.setOnClickPendingIntent(R.id.kstati_card, open(context, "kstati://tasks", 1))

    if (kind != Kind.MIC) {
      v.removeAllViews(R.id.kstati_list)
      val rows = visible(items, now, rowCount(context, kind, layout.inline, size, c.showMic))
      if (rows.isEmpty()) {
        val empty = RemoteViews(context.packageName, R.layout.kstati_item_empty)
        empty.setTextColor(R.id.kstati_title, c.time)
        v.addView(R.id.kstati_list, empty)
      }
      for (x in rows) {
        val row = RemoteViews(context.packageName, if (layout.inline) R.layout.kstati_item_inline else R.layout.kstati_item_stacked)
        row.setTextViewText(R.id.kstati_title, x.title)
        row.setTextColor(R.id.kstati_title, c.text)
        val label = whenLabel(x, now)
        if (label.isEmpty()) {
          row.setViewVisibility(R.id.kstati_time, View.GONE)
        } else {
          row.setViewVisibility(R.id.kstati_time, View.VISIBLE)
          row.setTextViewText(R.id.kstati_time, label)
          row.setTextColor(R.id.kstati_time, c.time)
        }
        v.addView(R.id.kstati_list, row)
      }
      v.setOnClickPendingIntent(R.id.kstati_list, open(context, "kstati://tasks", 1))
    }

    // Видимость задаём всегда явно: если раскладка та же, рабочий стол не создаёт виджет заново,
    // а применяет команды к уже показанному — однажды скрытый микрофон без VISIBLE так и остался бы скрытым
    if (c.showMic) {
      v.setViewVisibility(R.id.kstati_mic, View.VISIBLE)
      v.setInt(R.id.kstati_mic_bg, "setColorFilter", c.mic)
      v.setInt(R.id.kstati_mic_icon, "setColorFilter", c.onMic)
      v.setOnClickPendingIntent(R.id.kstati_mic, open(context, "kstati://record", 2))
    } else {
      v.setViewVisibility(R.id.kstati_mic, View.GONE)
    }
    return v
  }

  /**
   * Сколько строк дел поместится. Высоту знаем только со слов рабочего стола (бывает больше настоящей
   * на несколько процентов), поэтому считаем с запасом: лишняя строка не должна выглядывать обрезанной.
   */
  private fun rowCount(context: Context, kind: Kind, inline: Boolean, size: SizeF, showMic: Boolean): Int {
    val h = size.height * 0.94f
    val avail = when (kind) {
      Kind.ROW -> h - 2 * 10f
      Kind.TALL -> h - 2 * 14f - (if (showMic) 40f + 10f else 0f)
      Kind.MIC -> 0f
    }
    val scale = maxOf(1f, context.resources.configuration.fontScale)
    val rowH = (if (inline) 22f else 36f) * scale
    return floor(avail / rowH).toInt().coerceIn(1, 8)
  }

  /** Как система выбирает раскладку на Android 12+: из помещающихся — ближайшая по размеру; если ни одна — самая маленькая */
  private fun bestFit(size: SizeF): Layout {
    var best: Layout? = null
    var bestD = Float.MAX_VALUE
    for (l in LAYOUTS) {
      if (l.w > size.width + 0.5f || l.h > size.height + 0.5f) continue
      val dw = size.width - l.w
      val dh = size.height - l.h
      val d = dw * dw + dh * dh
      if (d < bestD) {
        best = l
        bestD = d
      }
    }
    return best ?: LAYOUTS.first()
  }

  /** Размер виджета (dp) со слов рабочего стола — только для числа строк и для Android < 12 */
  @Suppress("DEPRECATION")
  private fun reportedSize(context: Context, options: Bundle): SizeF {
    val portrait = context.resources.configuration.orientation != Configuration.ORIENTATION_LANDSCAPE
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      val sizes = options.getParcelableArrayList<SizeF>(AppWidgetManager.OPTION_APPWIDGET_SIZES)
      if (!sizes.isNullOrEmpty()) {
        // Обычно два размера: для вертикального экрана (уже и выше) и для горизонтального
        return sizes.filter { it.height > 0 }.let { list ->
          if (list.isEmpty()) sizes[0]
          else if (portrait) list.minBy { it.width / it.height } else list.maxBy { it.width / it.height }
        }
      }
    }
    val w = options.getInt(if (portrait) AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH else AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH)
    val h = options.getInt(if (portrait) AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT else AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT)
    return SizeF(if (w > 0) w.toFloat() else 180f, if (h > 0) h.toFloat() else 84f)
  }

  private fun open(context: Context, uri: String, code: Int): PendingIntent {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(context, code, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  /* ---------- цвета (как widgetColors в src/widget/data.ts) ---------- */

  private fun colors(dark: Boolean, p: Prefs): Colors {
    fun pick(tone: String, auto: Palette) = when (tone) {
      "light" -> LIGHT
      "dark" -> DARK
      else -> auto
    }
    val bgSet = pick(p.bg, if (dark) DARK else LIGHT)
    // Светлый текст — светлые буквы (из тёмной палитры), «как в теме» — контрастно к фону
    fun ink(tone: String) = when (tone) {
      "light" -> DARK
      "dark" -> LIGHT
      else -> bgSet
    }
    val micSet = ink(p.micTone)
    return Colors(
      bg = bgSet.bg,
      alpha = (p.opacity.coerceIn(0.0, 1.0) * 255).roundToInt(),
      text = ink(p.text).text,
      time = if (p.time == "auto") bgSet.muted else ink(p.time).text,
      mic = micSet.mic,
      onMic = micSet.onMic,
      showMic = p.mic,
    )
  }

  private fun isNight(context: Context) =
    (context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES

  /* ---------- дела ---------- */

  /** Первые n ещё не прошедших; у серии — только ближайший раз */
  private fun visible(items: List<Item>, now: Long, n: Int): List<Item> {
    val seen = HashSet<String>()
    val out = ArrayList<Item>()
    for (x in items) {
      if (x.until <= now || !seen.add(x.id)) continue
      out.add(x)
      if (out.size >= n) break
    }
    return out
  }

  /** «19:00» сегодня, «завтра 10:00», «сб 4 окт», «сегодня» */
  private fun whenLabel(x: Item, now: Long): String {
    val date = x.date ?: return x.time ?: ""
    val cal = Calendar.getInstance().apply { timeInMillis = now }
    val today = iso(cal)
    cal.add(Calendar.DAY_OF_MONTH, 1)
    val tomorrow = iso(cal)
    val day = when (date) {
      today -> ""
      tomorrow -> "завтра"
      else -> shortDate(date)
    }
    val time = x.time
    if (time != null) return if (day.isEmpty()) time else "$day $time"
    return day.ifEmpty { "сегодня" }
  }

  private fun iso(c: Calendar) = String.format(Locale.US, "%04d-%02d-%02d", c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))

  private fun shortDate(iso: String): String {
    val p = iso.split("-").map { it.toIntOrNull() ?: 0 }
    if (p.size < 3) return iso
    val c = Calendar.getInstance().apply { set(p[0], p[1] - 1, p[2], 12, 0, 0) }
    return "${WD[c.get(Calendar.DAY_OF_WEEK) - 1]} ${p[2]} ${MON[(p[1] - 1).coerceIn(0, 11)]}"
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

  private fun JSONObject.str(key: String): String? = if (has(key) && !isNull(key)) getString(key) else null

  private fun readSnapshot(context: Context): Snapshot? {
    val o = readJson(context, "widget.json") ?: return null
    val arr = o.optJSONArray("items")
    val items = ArrayList<Item>()
    if (arr != null) {
      for (i in 0 until arr.length()) {
        val x = arr.optJSONObject(i) ?: continue
        items.add(Item(x.optString("id"), x.optString("title"), x.str("date"), x.str("time"), x.optLong("until")))
      }
    }
    return Snapshot(items, if (o.has("dark")) o.optBoolean("dark") else null)
  }

  private fun readPrefs(context: Context, widgetId: Int): Prefs {
    val p = readJson(context, "widget-prefs.json")?.optJSONObject(widgetId.toString())
    return Prefs(
      mic = p?.optBoolean("mic", true) ?: true,
      opacity = p?.optDouble("opacity", 1.0) ?: 1.0,
      bg = p?.optString("bg", "auto") ?: "auto",
      text = p?.optString("text", "auto") ?: "auto",
      time = p?.optString("time", "auto") ?: "auto",
      micTone = p?.optString("micTone", "auto") ?: "auto",
    )
  }
}
