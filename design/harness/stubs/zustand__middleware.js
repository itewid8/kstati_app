// persist/devtools are pass-through; storage is never touched.
const pass = (f) => f;
module.exports = {
  persist: (f) => (set, get, api) => { api.persist = { rehydrate: async () => {}, hasHydrated: () => true, onFinishHydration: () => () => {}, onHydrate: () => () => {}, clearStorage() {}, setOptions() {}, getOptions: () => ({}) }; return f(set, get, api); },
  createJSONStorage: () => undefined, devtools: pass, subscribeWithSelector: pass, combine: (s, f) => (set, get, api) => ({ ...s, ...f(set, get, api) }),
};
