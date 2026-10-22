// Insets are 0: the mockups lay out content from y=0 of the 390x844 screen.
const React = require('react');
const { View } = require('react-native-web');
const insets = { top: 0, bottom: 0, left: 0, right: 0 };
const frame = { x: 0, y: 0, width: 390, height: 844 };
const Pass = ({ children }) => React.createElement(React.Fragment, null, children);
module.exports = {
  SafeAreaProvider: Pass, SafeAreaInsetsContext: React.createContext(insets),
  SafeAreaView: ({ edges, ...p }) => React.createElement(View, p),
  useSafeAreaInsets: () => insets, useSafeAreaFrame: () => frame,
  initialWindowMetrics: { insets, frame },
};
