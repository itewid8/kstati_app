package expo.modules.kstatishare

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.OpenableColumns
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * «Поделиться → Кстати»: текст (и текстовые файлы) из чужого приложения.
 * Интент приходит в MainActivity (фильтры добавляет plugins/withShareIntent.js): при запуске — в activity.intent,
 * когда приложение уже открыто — в onNewIntent (тогда событие onShare). take() отдаёт полученное один раз.
 */
class KstatiShareModule : Module() {
  private var pending: Map<String, Any?>? = null

  override fun definition() = ModuleDefinition {
    Name("KstatiShare")
    Events("onShare")

    Function("take") {
      if (pending == null) appContext.currentActivity?.intent?.let { read(it) }
      val p = pending
      pending = null
      p
    }

    OnNewIntent { intent ->
      if (read(intent)) sendEvent("onShare", mapOf<String, Any?>())
    }
  }

  private fun read(intent: Intent): Boolean {
    val action = intent.action ?: return false
    if (action != Intent.ACTION_SEND && action != Intent.ACTION_SEND_MULTIPLE) return false
    val texts = mutableListOf<String>()
    intent.getCharSequenceArrayListExtra(Intent.EXTRA_TEXT)?.forEach { if (it.isNotBlank()) texts.add(it.toString()) }
    if (texts.isEmpty()) intent.getCharSequenceExtra(Intent.EXTRA_TEXT)?.let { if (it.isNotBlank()) texts.add(it.toString()) }
    val files = mutableListOf<Map<String, Any?>>()
    var skipped = 0
    for (uri in streams(intent, action)) {
      val type = appContext.reactContext?.contentResolver?.getType(uri) ?: ""
      val name = nameOf(uri)
      val isText = type.startsWith("text/") || type == "application/json" || name.endsWith(".txt") || name.endsWith(".md")
      val text = if (isText) readText(uri) else null
      if (text != null) files.add(mapOf("name" to name, "text" to text)) else skipped++
    }
    val subject = intent.getStringExtra(Intent.EXTRA_SUBJECT) ?: intent.getStringExtra(Intent.EXTRA_TITLE)
    val from = try {
      appContext.currentActivity?.referrer?.host
    } catch (e: Exception) {
      null
    }
    pending = mapOf("subject" to subject, "texts" to texts, "files" to files, "skipped" to skipped, "from" to from)
    // Обработано: при пересоздании экрана тот же интент не придёт второй раз
    intent.action = Intent.ACTION_MAIN
    intent.removeExtra(Intent.EXTRA_TEXT)
    intent.removeExtra(Intent.EXTRA_STREAM)
    return true
  }

  @Suppress("DEPRECATION")
  private fun streams(intent: Intent, action: String): List<Uri> =
    if (action == Intent.ACTION_SEND_MULTIPLE) {
      if (Build.VERSION.SDK_INT >= 33) intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri::class.java) ?: emptyList()
      else intent.getParcelableArrayListExtra<Uri>(Intent.EXTRA_STREAM) ?: emptyList()
    } else {
      val one = if (Build.VERSION.SDK_INT >= 33) intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri::class.java) else intent.getParcelableExtra<Uri>(Intent.EXTRA_STREAM)
      listOfNotNull(one)
    }

  private fun nameOf(uri: Uri): String {
    val resolver = appContext.reactContext?.contentResolver ?: return uri.lastPathSegment ?: ""
    return try {
      resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
        if (c.moveToFirst()) c.getString(0) else null
      } ?: (uri.lastPathSegment ?: "")
    } catch (e: Exception) {
      uri.lastPathSegment ?: ""
    }
  }

  /** Текстовый файл до 1 МБ */
  private fun readText(uri: Uri): String? {
    val resolver = appContext.reactContext?.contentResolver ?: return null
    return try {
      resolver.openInputStream(uri)?.use { s ->
        val bytes = s.readBytes()
        if (bytes.size > 1_000_000) null else String(bytes, Charsets.UTF_8)
      }
    } catch (e: Exception) {
      null
    }
  }
}
