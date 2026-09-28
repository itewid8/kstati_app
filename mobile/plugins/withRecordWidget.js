/**
 * Виджет «Кстати» на рабочий стол Android: квадрат 1×1 со знаком из трёх столбиков.
 * Нажатие открывает приложение по ссылке kstati://record — и сразу начинается запись голоса.
 *
 * Это обычный нативный виджет Android (AppWidgetProvider + RemoteViews), без сторонних библиотек.
 * Плагин при `npx expo prebuild` кладёт в android/ класс виджета, разметку, картинку и запись в манифест.
 */
const fs = require('fs');
const path = require('path');
const { withAndroidManifest, withDangerousMod, AndroidConfig } = require('@expo/config-plugins');

const RECEIVER = '.RecordWidget';

function withManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.receiver = (app.receiver ?? []).filter((r) => r.$['android:name'] !== RECEIVER);
    app.receiver.push({
      $: { 'android:name': RECEIVER, 'android:exported': 'false', 'android:label': '@string/record_widget_label' },
      'intent-filter': [{ action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }] }],
      'meta-data': [{ $: { 'android:name': 'android.appwidget.provider', 'android:resource': '@xml/record_widget_info' } }],
    });
    return cfg;
  });
}

function withFiles(config) {
  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkg = cfg.android?.package;
      const scheme = Array.isArray(cfg.scheme) ? cfg.scheme[0] : cfg.scheme;
      const root = path.join(cfg.modRequest.platformProjectRoot, 'app', 'src', 'main');
      const res = path.join(root, 'res');
      const write = (rel, text) => {
        const file = path.join(root, rel);
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, text);
      };

      write(
        path.join('java', ...pkg.split('.'), 'RecordWidget.kt'),
        `package ${pkg}

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews

/** Виджет «Кстати»: нажатие открывает приложение сразу в записи голоса (${scheme}://record) */
class RecordWidget : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("${scheme}://record"))
      .setPackage(context.packageName)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    val pending = PendingIntent.getActivity(
      context, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    for (id in ids) {
      val views = RemoteViews(context.packageName, R.layout.record_widget)
      views.setOnClickPendingIntent(R.id.record_widget_root, pending)
      manager.updateAppWidget(id, views)
    }
  }
}
`,
      );

      write(
        path.join('res', 'layout', 'record_widget.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/record_widget_root"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:background="@drawable/record_widget_bg"
    android:contentDescription="@string/record_widget_label"
    android:padding="12dp">
  <ImageView
      android:layout_width="match_parent"
      android:layout_height="match_parent"
      android:layout_gravity="center"
      android:scaleType="fitCenter"
      android:src="@drawable/record_widget_icon"
      android:importantForAccessibility="no" />
</FrameLayout>
`,
      );

      write(
        path.join('res', 'drawable', 'record_widget_bg.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
  <solid android:color="#1E1E1E" />
  <corners android:radius="22dp" />
</shape>
`,
      );

      fs.mkdirSync(path.join(res, 'drawable-nodpi'), { recursive: true });
      fs.copyFileSync(path.join(__dirname, 'widget', 'widget_icon.png'), path.join(res, 'drawable-nodpi', 'record_widget_icon.png'));

      write(
        path.join('res', 'xml', 'record_widget_info.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="40dp"
    android:minHeight="40dp"
    android:targetCellWidth="1"
    android:targetCellHeight="1"
    android:updatePeriodMillis="0"
    android:initialLayout="@layout/record_widget"
    android:previewLayout="@layout/record_widget"
    android:previewImage="@drawable/record_widget_icon"
    android:description="@string/record_widget_description"
    android:resizeMode="none"
    android:widgetCategory="home_screen" />
`,
      );

      write(
        path.join('res', 'values', 'record_widget_strings.xml'),
        `<?xml version="1.0" encoding="utf-8"?>
<resources>
  <string name="record_widget_label">Кстати — сказать</string>
  <string name="record_widget_description">Нажмите и скажите: дело, хотелку или что посмотреть</string>
</resources>
`,
      );
      return cfg;
    },
  ]);
}

module.exports = function withRecordWidget(config) {
  return withFiles(withManifest(config));
};
