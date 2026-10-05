package expo.modules.kstatinet

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Сеть телефона: включён ли VPN (сервер в России через VPN часто недоступен) */
class KstatiNetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("KstatiNet")

    Function("isVpnActive") {
      val context = appContext.reactContext ?: return@Function false
      val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager ?: return@Function false
      val caps = cm.getNetworkCapabilities(cm.activeNetwork) ?: return@Function false
      caps.hasTransport(NetworkCapabilities.TRANSPORT_VPN)
    }
  }
}
