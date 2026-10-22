const React = require('react');
const RN = require('react-native-web');
// Gesture.Pan().onStart(...).minDistance(...) -> chainable no-op builder
const builder = () => new Proxy({}, { get: (t, k) => (k === 'then' ? undefined : () => builder()) });
const Pass = ({ children }) => React.createElement(React.Fragment, null, children);
module.exports = {
  GestureHandlerRootView: (p) => React.createElement(RN.View, p),
  GestureDetector: Pass, Gesture: new Proxy({}, { get: () => () => builder() }),
  Swipeable: Pass, ScrollView: RN.ScrollView, FlatList: RN.FlatList, Pressable: RN.Pressable,
  TouchableOpacity: RN.TouchableOpacity, RectButton: RN.Pressable, BorderlessButton: RN.Pressable,
  State: {}, Directions: {},
};
module.exports.default = module.exports;
