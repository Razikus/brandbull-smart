export default {
  "expo": {
    "name": "Brandbull SMART",
    "slug": "bb-smart",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/logo.png",
    "scheme": "bbsmart",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "eu.razniewski.bbsmart",
      "icon": "./assets/logo.png",
      "infoPlist": {
        "NSBluetoothAlwaysUsageDescription": "This app needs Bluetooth access to connect and configure smart home devices",
        "NSBluetoothPeripheralUsageDescription": "This app needs Bluetooth access to discover and connect to smart home devices",
        "NSLocationWhenInUseUsageDescription": "This app needs location access to read WiFi network information for device configuration"
      }
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/logo.png",
        "backgroundColor": "#000000"
      },
      "googleServicesFile": process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
      "edgeToEdgeEnabled": true,
      "package": "eu.razniewski.bbsmart"
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/brand.png"
    },
    "plugins": [
      "expo-router",
      [
        "expo-build-properties",
        {
          "android": {
            "minSdkVersion": 26
          },
          "ios": {
            "deploymentTarget": "15.1"
          }
        }
      ],
      "./plugins/heiman-bluetooth-plugin",
      "./plugins/heiman-ios-plugin",
      "expo-router",
      [
        "expo-splash-screen",
        {
          "image": "./assets/brand.png",
          "imageWidth": 200,
          "resizeMode": "contain",
          "backgroundColor": "#000000"
        }
      ],
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.443024442162-41n791gncnn4j0bbpi05jub6bd000rdh"
        }
      ],

      [
        "expo-notifications",
        {
          "icon": "./assets/notif.png",
          "color": "#c22218",
          "defaultChannel": "default",
          "sounds": [
            "./assets/dym.wav",
            "./assets/ratownik.wav"
          ],
          "enableBackgroundRemoteNotifications": false
        }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    },
    "extra": {
      "router": {},
      "eas": {
        "projectId": "9ed84c7e-cc28-407c-bf83-d3081299a547"
      }
    }
  }
}
