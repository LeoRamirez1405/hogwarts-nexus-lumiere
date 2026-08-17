import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nexus.app',
  appName: 'Nexus',
  webDir: 'public', // Static assets bundled into the APK
  server: {
    androidScheme: 'https',
    // Prod: the APK is a wrapper that loads the deployed PWA (keeps auth
    // cookies first-party on the web domain). Dev: override with
    // CAPACITOR_SERVER_URL=http://localhost:3000 for live reload.
    url:
      process.env.CAPACITOR_SERVER_URL ||
      process.env.CAPACITOR_DEV_SERVER ||
      'https://hogwarts-nexus-lumiere.vercel.app',
    cleartext: true
  },
  ios: {
    contentInset: 'automatic'
  },
  android: {
    allowMixedContent: true
  }
};

export default config;