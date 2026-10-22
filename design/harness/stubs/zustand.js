// Minimal zustand (create / useStore) for rendering screens offline.
const React = require('react');
function createStore(init) {
  let state; const subs = new Set();
  const setState = (p, replace) => { const n = typeof p === 'function' ? p(state) : p; if (!Object.is(n, state)) { state = replace || typeof n !== 'object' ? n : { ...state, ...n }; subs.forEach((l) => l(state)); } };
  const api = { setState, getState: () => state, getInitialState: () => state, subscribe: (l) => (subs.add(l), () => subs.delete(l)) };
  state = init(setState, api.getState, api);
  return api;
}
function useStore(api, sel = (s) => s) { return React.useSyncExternalStore(api.subscribe, () => sel(api.getState())); }
function create(init) {
  if (!init) return create;
  const api = createStore(init);
  return Object.assign((sel) => useStore(api, sel), api);
}
module.exports = { create, createStore, useStore };
