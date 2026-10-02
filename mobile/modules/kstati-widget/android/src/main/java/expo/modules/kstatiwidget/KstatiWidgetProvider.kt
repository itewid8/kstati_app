package expo.modules.kstatiwidget

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.os.Bundle

/** Android сообщает о виджете: добавили, прошло 30 минут, изменили размер, сработал наш будильник */
class KstatiWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    KstatiWidget.updateAll(context)
  }

  override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, widgetId: Int, options: Bundle) {
    KstatiWidget.update(context, widgetId)
  }

  override fun onDisabled(context: Context) {
    KstatiWidget.cancelRefresh(context)
  }

  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action == KstatiWidget.ACTION_REFRESH) KstatiWidget.updateAll(context) else super.onReceive(context, intent)
  }
}
