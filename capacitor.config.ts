import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.betese.pmu',
  appName: 'Betese PMU',
  webDir: 'dist',
  android: {
    buildOptions: {
      releaseType: 'AAB',
    },
  },
};

export default config;
