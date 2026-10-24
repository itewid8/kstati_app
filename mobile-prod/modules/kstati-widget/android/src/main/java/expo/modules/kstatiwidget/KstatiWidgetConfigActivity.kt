package expo.modules.kstatiwidget

import android.appwidget.AppWidgetManager
import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactActivityDelegate

/**
 * Настройки виджета (долгое нажатие → «Настроить»). Сам экран — на React Native
 * (компонент KstatiWidgetConfig из src/widget/WidgetConfig.tsx), сюда передаём id виджета.
 */
class KstatiWidgetConfigActivity : ReactActivity() {
  private val widgetId: Int
    get() = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
    // Закрыли «назад» — настройка отменена
    setResult(RESULT_CANCELED, result())
    if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) finish()
  }

  fun finishWith(ok: Boolean) {
    setResult(if (ok) RESULT_OK else RESULT_CANCELED, result())
    finish()
  }

  private fun result() = Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId)

  override fun getMainComponentName(): String = COMPONENT

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    object : DefaultReactActivityDelegate(this, COMPONENT, DefaultNewArchitectureEntryPoint.fabricEnabled) {
      override fun getLaunchOptions(): Bundle = Bundle().apply { putInt("widgetId", widgetId) }
    }

  companion object {
    /** Имя экрана, зарегистрированного в index.ts (AppRegistry.registerComponent) */
    const val COMPONENT = "KstatiWidgetConfig"
  }
}
