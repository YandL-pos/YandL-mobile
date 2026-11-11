// Bluetooth printing permissions, scoped by Android version (app.json `permissions` can't set attributes).
// Android 12+ (API 31+) scans and connects with BLUETOOTH_SCAN/CONNECT and needs no location;
// Android 11 and below need the old BLUETOOTH/BLUETOOTH_ADMIN plus location to discover printers.
// The printer library declares the old ones without limits, so these replace its entries.
const { withAndroidManifest } = require('expo/config-plugins');

const LEGACY_UP_TO_API_30 = [
  'android.permission.BLUETOOTH',
  'android.permission.BLUETOOTH_ADMIN',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.ACCESS_COARSE_LOCATION',
];

const upsertPermission = (manifest, name, attributes) => {
  manifest['uses-permission'] = manifest['uses-permission'] || [];
  const list = manifest['uses-permission'];
  const existing = list.find((p) => p.$['android:name'] === name);
  const entry = { $: { 'android:name': name, ...attributes } };
  if (existing) existing.$ = entry.$;
  else list.push(entry);
};

module.exports = function withBluetoothPermissions(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] || 'http://schemas.android.com/tools';

    for (const name of LEGACY_UP_TO_API_30) {
      upsertPermission(manifest, name, { 'android:maxSdkVersion': '30', 'tools:replace': 'android:maxSdkVersion' });
    }
    // Discovery results aren't used to work out where the device is
    upsertPermission(manifest, 'android.permission.BLUETOOTH_SCAN', {
      'android:usesPermissionFlags': 'neverForLocation',
      'tools:targetApi': 's',
    });
    upsertPermission(manifest, 'android.permission.BLUETOOTH_CONNECT', {});
    return cfg;
  });
};
