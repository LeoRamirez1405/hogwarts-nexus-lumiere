import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nexus.app',
  appName: 'Nexus',
  webDir: 'public',
  server: {
    androidScheme: 'https',
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
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"]
    }
  }
};

export default config;