// Fallback stub (warned at bundle time). Add a real stub file next to it when a screen needs one.
// for any native-only / missing module: every property is a no-op
// function that is also usable as a component (renders its children) or a value.
const React = require('react');
function make(name) {
  const fn = function (props) { return props && props.children !== undefined ? React.createElement(React.Fragment, null, props.children) : null; };
  return new Proxy(fn, {
    get(t, k) {
      if (k === '__esModule') return true;
      if (k === 'default') return make(name + '.default');
      if (k === Symbol.toPrimitive) return () => '';
      if (k === 'then') return undefined;
      if (typeof k === 'symbol' || k === 'prototype' || k === 'displayName') return t[k];
      return make(name + '.' + String(k));
    },
    // called as a component with children -> render children; otherwise (hook/function) -> another stub
    apply(t, self, args) {
      const a = args[0];
      return a && typeof a === 'object' && 'children' in a ? fn(a) : make(name + '()');
    },
    construct() { return make('new ' + name); },
  });
}
module.exports = make('stub');
