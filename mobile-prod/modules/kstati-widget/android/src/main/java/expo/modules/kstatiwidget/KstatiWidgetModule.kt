package expo.modules.kstatiwidget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Мост из JS: перерисовать виджеты, закрыть окно настроек */
class KstatiWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KstatiWidget")

    Function("reload") {
      val context = appContext.reactContext
      if (context != null) KstatiWidget.updateAll(context)
    }

    Function("reloadWidget") { widgetId: Int ->
      val context = appContext.reactContext
      if (context != null) KstatiWidget.update(context, widgetId)
    }

    Function("finishConfig") { ok: Boolean ->
      val activity = appContext.currentActivity as? KstatiWidgetConfigActivity
      if (activity != null) activity.runOnUiThread { activity.finishWith(ok) }
    }
  }
}
