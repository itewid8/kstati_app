/**
 * Сеть на Android: сначала IPv4, и таймаут на соединение 10 с.
 *
 * Зачем: у адресов Яндекс Облака есть IPv6. Если в сети телефона IPv6 «объявлен», но не работает,
 * OkHttp внутри React Native (версия 4.x, без таймаутов по умолчанию) стучится по IPv6 и висит бесконечно.
 * Браузер в такой сети сам переключается на IPv4, а приложение — нет.
 * Плагин подключает свою фабрику OkHttp: адреса IPv4 идут первыми, а зависшее соединение
 * через 10 с бросается и пробуется следующий адрес. Действует и на fetch из expo, и на fetch из RN.
 */
const fs = require('fs');
const path = require('path');
const { withMainApplication, withDangerousMod } = require('@expo/config-plugins');

const CLASS = 'KstatiHttpClientFactory';

const kotlin = (pkg) => `package ${pkg}

import android.content.Context
import com.facebook.react.modules.network.OkHttpClientFactory
import com.facebook.react.modules.network.OkHttpClientProvider
import java.net.Inet4Address
import java.net.InetAddress
import java.util.concurrent.TimeUnit
import okhttp3.Dns
import okhttp3.OkHttpClient

/** Создан плагином plugins/withIpv4First.js — правки вносите туда */
class ${CLASS}(private val context: Context) : OkHttpClientFactory {
  override fun createNewNetworkModuleClient(): OkHttpClient =
    OkHttpClientProvider.createClientBuilder(context)
      .connectTimeout(10, TimeUnit.SECONDS)
      .dns(Ipv4FirstDns)
      .build()
}

object Ipv4FirstDns : Dns {
  override fun lookup(hostname: String): List<InetAddress> =
    Dns.SYSTEM.lookup(hostname).sortedBy { if (it is Inet4Address) 0 else 1 }
}
`;

function withFactoryFile(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkg = cfg.android.package;
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main', 'java', ...pkg.split('.'));
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, `${CLASS}.kt`), kotlin(pkg));
      return cfg;
    },
  ]);
}

function withRegister(config) {
  return withMainApplication(config, (cfg) => {
    let src = cfg.modResults.contents;
    if (!src.includes(`${CLASS}(`)) {
      src = src.replace(
        /(\n(\s*)loadReactNative\(this\))/,
        `\n$2com.facebook.react.modules.network.OkHttpClientProvider.setOkHttpClientFactory(${CLASS}(this))$1`,
      );
      if (!src.includes(`${CLASS}(`)) throw new Error('withIpv4First: не нашёл loadReactNative(this) в MainApplication');
    }
    cfg.modResults.contents = src;
    return cfg;
  });
}

module.exports = (config) => withRegister(withFactoryFile(config));
