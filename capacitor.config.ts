import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.nexusaitrader.dashboard',
  appName: 'Nexus AI Trader',
  webDir: 'dist', // This assumes your web app's build output directory is 'dist'
  server: {
    androidScheme: 'https'
  }
};

export default config;