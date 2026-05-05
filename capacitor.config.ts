import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.betese.pmu',
  appName: 'Betese PMU',
  webDir: 'dist',
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
