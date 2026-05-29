import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.betese.pmu',
  appName: 'Betese PMU',
  webDir: 'dist',
  // Thin-webview APK: load the live Next.js site instead of bundling a static
  // export. This keeps the APK in sync with web deploys (every push reaches
  // the terminal instantly) while letting the registered native plugins
  // (Sunmi inner printer, Bluetooth thermal, RawBT, Mate BT, NativePrint)
  // still fire on the device.
  server: {
    url: 'https://betesepmu.com',
    cleartext: false,
  },
  android: {
    buildOptions: {
      releaseType: 'AAB',
    },
  },
};

export default config;
