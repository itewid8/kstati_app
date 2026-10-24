/**
 * Поверх app.json. Виджет на iPhone (expo-widgets) требует общую группу приложений (App Groups), а бесплатный
 * Apple ID её не подписывает. Поэтому по умолчанию iOS-виджета нет; Android-виджет (modules/kstati-widget) есть всегда.
 * С платным аккаунтом: `npm i expo-widgets @expo/ui`, перенести widget-ios/*.tsx в src/widget/ и собрать с
 *   KSTATI_IOS_WIDGET=1 npx expo prebuild -p ios --clean && KSTATI_IOS_WIDGET=1 npx expo run:ios --device --configuration Release
 * Свои id: ru.kstati.app.widgets и group.ru.kstati.app — со старым приложением не пересекаются.
 */
const IOS_WIDGET = process.env.KSTATI_IOS_WIDGET === '1';

const WIDGET_PLUGIN = [
  "expo-widgets",
  {
    "bundleIdentifier": "ru.kstati.app.widgets",
    "groupIdentifier": "group.ru.kstati.app",
    "widgets": [
      {
        "name": "KstatiWidget",
        "displayName": "Кстати β",
        "description": "Ближайшие дела и микрофон",
        "ios": {
          "supportedFamilies": [
            "systemSmall",
            "systemMedium",
            "systemLarge",
            "accessoryCircular",
            "accessoryRectangular"
          ],
          "configuration": {
            "title": "Кстати",
            "parameters": {
              "mic": {
                "title": "Микрофон",
                "type": "boolean",
                "default": true
              },
              "micTone": {
                "title": "Цвет микрофона",
                "type": "enum",
                "values": [
                  {
                    "name": "Как в теме",
                    "value": "auto"
                  },
                  {
                    "name": "Светлый",
                    "value": "light"
                  },
                  {
                    "name": "Тёмный",
                    "value": "dark"
                  }
                ],
                "default": "auto"
              },
              "bg": {
                "title": "Фон",
                "type": "enum",
                "values": [
                  {
                    "name": "Как в теме",
                    "value": "auto"
                  },
                  {
                    "name": "Светлый",
                    "value": "light"
                  },
                  {
                    "name": "Тёмный",
                    "value": "dark"
                  }
                ],
                "default": "auto"
              },
              "text": {
                "title": "Цвет названий",
                "type": "enum",
                "values": [
                  {
                    "name": "Как в теме",
                    "value": "auto"
                  },
                  {
                    "name": "Светлый",
                    "value": "light"
                  },
                  {
                    "name": "Тёмный",
                    "value": "dark"
                  }
                ],
                "default": "auto"
              },
              "time": {
                "title": "Цвет времени",
                "type": "enum",
                "values": [
                  {
                    "name": "Как в теме",
                    "value": "auto"
                  },
                  {
                    "name": "Светлый",
                    "value": "light"
                  },
                  {
                    "name": "Тёмный",
                    "value": "dark"
                  }
                ],
                "default": "auto"
              }
            }
          }
        }
      }
    ]
  }
];

module.exports = ({ config }) => (IOS_WIDGET ? { ...config, plugins: [...(config.plugins ?? []), WIDGET_PLUGIN] } : config);
