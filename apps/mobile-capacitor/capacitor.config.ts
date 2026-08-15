import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.cyberblade3d.game",
  appName: "CyberBlade 3D",
  webDir: "../web/dist",
  server: {
    androidScheme: "https"
  },
  ios: {
    contentInset: "never",
    backgroundColor: "#020106",
    allowsLinkPreview: false
  },
  plugins: {
    ScreenOrientation: {
      orientation: "portrait"
    },
    StatusBar: {
      style: "DARK",
      overlaysWebView: true
    }
  }
};

export default config;
