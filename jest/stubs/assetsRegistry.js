// סטאב לטסטים: react-native-svg (web) מבקש את @react-native/assets-registry/registry, שלא מותקן בפרויקט.
const assets = [];
module.exports = {
  registerAsset(asset) {
    return assets.push(asset);
  },
  getAssetByID(id) {
    return assets[id - 1];
  },
};
