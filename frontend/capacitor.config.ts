import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nexus.app',
  appName: 'Hogwarts Nexus',
  webDir: '.next/server/app', // Next.js build output
  server: {
    androidScheme: 'https',
    url: process.env.CAPACITOR_DEV_SERVER || 'http://localhost:3000',
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
