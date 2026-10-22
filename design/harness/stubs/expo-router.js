const React = require('react');
const router = { push() {}, replace() {}, back() {}, navigate() {}, dismiss() {}, dismissAll() {}, setParams() {}, canGoBack: () => false };
const Pass = ({ children }) => (children === undefined ? null : React.createElement(React.Fragment, null, children));
const Navigator = Object.assign(Pass, { Screen: () => null, Protected: Pass });
const Link = Object.assign(({ children, asChild }) => React.createElement(React.Fragment, null, children), { Trigger: Pass, Preview: () => null, Menu: Pass, MenuAction: () => null });
module.exports = {
  router, useRouter: () => router, useLocalSearchParams: () => ({}), useGlobalSearchParams: () => ({}),
  usePathname: () => '/', useSegments: () => [], useNavigation: () => ({ setOptions() {}, addListener: () => () => {} }),
  useFocusEffect: (cb) => React.useEffect(() => cb(), []), useRootNavigationState: () => ({ key: 'root' }),
  Link, Redirect: () => null, Stack: Navigator, Tabs: Navigator, Slot: Pass, SplashScreen: { preventAutoHideAsync: async () => {}, hideAsync: async () => {} },
};
