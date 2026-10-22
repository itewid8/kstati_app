// Static stand-in: animated components are plain RN-web components and animations
// resolve to their target value immediately (screenshots show the settled state).
const React = require('react');
const RN = require('react-native-web');
const createAnimatedComponent = (C) => C;
const id = (v) => v;
const layoutAnim = new Proxy(function () {}, { get: (t, k) => (k === 'then' ? undefined : () => layoutAnim), apply: () => layoutAnim, construct: () => layoutAnim });
const Animated = { View: RN.View, Text: RN.Text, ScrollView: RN.ScrollView, Image: RN.Image, FlatList: RN.FlatList, createAnimatedComponent };
const Easing = new Proxy({}, { get: () => (...a) => (typeof a[0] === 'function' ? a[0] : id) });
module.exports = {
  __esModule: true, default: Animated, ...Animated,
  useSharedValue: (v) => React.useRef({ value: v, get: () => v, set() {} }).current,
  useAnimatedStyle: (fn) => fn(), useDerivedValue: (fn) => ({ value: fn() }), useAnimatedProps: (fn) => fn(),
  useAnimatedReaction: () => {}, useAnimatedRef: () => React.useRef(null), useAnimatedScrollHandler: () => () => {},
  useScrollViewOffset: () => ({ value: 0 }), useReducedMotion: () => true,
  withTiming: id, withSpring: id, withDecay: () => 0, withDelay: (_, v) => v, withSequence: (...v) => v[v.length - 1], withRepeat: id,
  cancelAnimation: () => {}, runOnJS: (f) => f, runOnUI: (f) => f, interpolate: (v, i, o) => o[0], interpolateColor: (v, i, o) => o[0],
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' }, Easing, ReduceMotion: { System: 0, Always: 1, Never: 2 },
  LayoutAnimationConfig: ({ children }) => React.createElement(React.Fragment, null, children),
  FadeIn: layoutAnim, FadeOut: layoutAnim, FadeInDown: layoutAnim, FadeInUp: layoutAnim, FadeOutDown: layoutAnim, FadeOutUp: layoutAnim,
  SlideInDown: layoutAnim, SlideOutDown: layoutAnim, SlideInUp: layoutAnim, SlideOutUp: layoutAnim, ZoomIn: layoutAnim, ZoomOut: layoutAnim,
  LinearTransition: layoutAnim, Layout: layoutAnim, CurvedTransition: layoutAnim, Keyframe: layoutAnim,
};
