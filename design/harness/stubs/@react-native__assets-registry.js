// Used by react-native-svg's resolveAssetUri; no bundled assets on the harness page.
const assets = [];
module.exports = { registerAsset: (a) => assets.push(a), getAssetByID: (id) => assets[id - 1] };
