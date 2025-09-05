const { 
  withDangerousMod,
  withInfoPlist,
  withXcodeProject,
  IOSConfig
} = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

/**
 * Expo Config Plugin for Heiman Bluetooth SDK - iOS Only
 */
function withHeimanBluetoothIOS(config, options = {}) {
  
  const pluginOptions = {
    iosDeploymentTarget: options.iosDeploymentTarget || '15.1',
    frameworkPath: options.frameworkPath || 'assets/ios/HmDeviceCenter.framework',
    ...options
  };

  // 1. Add iOS permissions to Info.plist
  config = withInfoPlist(config, (config) => {
    const permissions = {
      'NSBluetoothAlwaysUsageDescription': 'This app needs Bluetooth access to connect and configure smart home devices',
      'NSBluetoothPeripheralUsageDescription': 'This app needs Bluetooth access to discover and connect to smart home devices', 
      'NSLocationWhenInUseUsageDescription': 'This app needs location access to read WiFi network information for device configuration'
    };

    Object.entries(permissions).forEach(([key, value]) => {
      config.modResults[key] = value;
    });

    return config;
  });

  const projectName =  'BrandbullSMART';

  // 2. Configure Xcode project
  config = withXcodeProject(config, (config) => {
    const xcodeProject = config.modResults;
    const configurations = xcodeProject.pbxXCBuildConfigurationSection();
    
    Object.keys(configurations).forEach(key => {
      const configuration = configurations[key];
      if (configuration && configuration.buildSettings) {
        
        // Set deployment target
        configuration.buildSettings.IPHONEOS_DEPLOYMENT_TARGET = pluginOptions.iosDeploymentTarget;

        // configuration.buildSettings.SWIFT_OBJC_BRIDGING_HEADER = `${projectName}/${projectName}-Bridging-Header.h`;

        
        // Add framework search paths - fix the array format
        if (!configuration.buildSettings.FRAMEWORK_SEARCH_PATHS) {
          configuration.buildSettings.FRAMEWORK_SEARCH_PATHS = ['"$(inherited)"'];
        } else if (typeof configuration.buildSettings.FRAMEWORK_SEARCH_PATHS === 'string') {
          configuration.buildSettings.FRAMEWORK_SEARCH_PATHS = [configuration.buildSettings.FRAMEWORK_SEARCH_PATHS];
        }
        
        const frameworkSearchPaths = [
          '"$(SRCROOT)/../assets/ios"'
        ];
        
        // Ensure it's an array and add paths that don't exist
        if (Array.isArray(configuration.buildSettings.FRAMEWORK_SEARCH_PATHS)) {
          frameworkSearchPaths.forEach(path => {
            if (!configuration.buildSettings.FRAMEWORK_SEARCH_PATHS.includes(path)) {
              configuration.buildSettings.FRAMEWORK_SEARCH_PATHS.push(path);
            }
          });
        }

        // Add linker flags for framework - fix the array format
        if (!configuration.buildSettings.OTHER_LDFLAGS) {
          configuration.buildSettings.OTHER_LDFLAGS = ['"$(inherited)"'];
        } else if (typeof configuration.buildSettings.OTHER_LDFLAGS === 'string') {
          configuration.buildSettings.OTHER_LDFLAGS = [configuration.buildSettings.OTHER_LDFLAGS];
        }
        
        const linkerFlags = [
          '"-framework"', '"HmDeviceCenter"'
        ];
        
        if (Array.isArray(configuration.buildSettings.OTHER_LDFLAGS)) {
          linkerFlags.forEach(flag => {
            if (!configuration.buildSettings.OTHER_LDFLAGS.includes(flag)) {
              configuration.buildSettings.OTHER_LDFLAGS.push(flag);
            }
          });
        }
        

        // Enable modules
        configuration.buildSettings.CLANG_ENABLE_MODULES = 'YES';
        
        // Header search paths - fix the array format
        if (!configuration.buildSettings.HEADER_SEARCH_PATHS) {
          configuration.buildSettings.HEADER_SEARCH_PATHS = ['"$(inherited)"'];
        } else if (typeof configuration.buildSettings.HEADER_SEARCH_PATHS === 'string') {
          configuration.buildSettings.HEADER_SEARCH_PATHS = [configuration.buildSettings.HEADER_SEARCH_PATHS];
        }
        
        const headerSearchPath = '"$(SRCROOT)/../assets/ios/HmDeviceCenter.framework/Headers"';
        if (Array.isArray(configuration.buildSettings.HEADER_SEARCH_PATHS)) {
          if (!configuration.buildSettings.HEADER_SEARCH_PATHS.includes(headerSearchPath)) {
            configuration.buildSettings.HEADER_SEARCH_PATHS.push(headerSearchPath);
          }
        }
      }
    });


    const filesToCompile = [
      'BrandbullSMART/HeimanBluetoothModule.h',
      'BrandbullSMART/HeimanBluetoothModule.m'
    ];

    filesToCompile.forEach(fileName => {
      try {
        // Add source file to project
        const file = xcodeProject.addSourceFile(
          fileName,
          { target: xcodeProject.getFirstTarget().uuid },
          xcodeProject.findPBXGroupKey({ name: projectName })
        );
        
        console.log(`✅ Added ${fileName} to Xcode project for compilation`);
        
      } catch (error) {
        // File might already exist, which is fine
        console.log(`ℹ️ ${fileName} already in project or couldn't add: ${error.message}`);
      }
    });

    return config;
  });

  // 3. Copy native files and framework
  config = withDangerousMod(config, [
    'ios',
    (config) => {
      copyiOSFiles(config, pluginOptions);
      return config;
    },
  ]);

  return config;
}

function createBridgingHeader(targetDir, projectName) {
  const bridgingHeaderContent = `//
//  ${projectName}-Bridging-Header.h
//  ${projectName}
//
//  Generated by Heiman Bluetooth Plugin
//

#ifndef ${projectName}_Bridging_Header_h
#define ${projectName}_Bridging_Header_h

#import "HeimanBluetoothModule.h"

#endif /* ${projectName}_Bridging_Header_h */
`;

  fs.writeFileSync(path.join(targetDir, `${projectName}-Bridging-Header.h`), bridgingHeaderContent);
  console.log(`✅ Created ${projectName}-Bridging-Header.h`);
}

/**
 * Copy iOS native files and framework
 */
function copyiOSFiles(config, options) {
  const projectRoot = config.modRequest.projectRoot;
  const platformProjectRoot = config.modRequest.platformProjectRoot;
  
  // Use the actual iOS project name (slug without spaces/special chars)
  const projectName =  'BrandbullSMART';
  
  // Paths
  const sourceFrameworkPath = path.join(projectRoot, options.frameworkPath);
  const sourceNativeFilesPath = path.join(projectRoot, 'template-files/ios');
  const targetDir = path.join(platformProjectRoot, projectName);
  
  console.log('🍎 Setting up iOS Heiman Bluetooth...');
  
  try {
    // Ensure target directory exists
    fs.mkdirSync(targetDir, { recursive: true });

    // 1. Copy HmDeviceCenter.framework
    if (fs.existsSync(sourceFrameworkPath)) {
      const targetFrameworkPath = path.join(targetDir, 'HmDeviceCenter.framework');
      
      // Remove existing framework
      if (fs.existsSync(targetFrameworkPath)) {
        fs.rmSync(targetFrameworkPath, { recursive: true, force: true });
      }
      
      // Copy framework
      copyDirectoryRecursive(sourceFrameworkPath, targetFrameworkPath);
      console.log('✅ Copied HmDeviceCenter.framework');
    } else {
      console.warn(`⚠️  Framework not found at: ${sourceFrameworkPath}`);
      console.warn('   Please ensure HmDeviceCenter.framework is in the assets/ios directory');
    }

    // 2. Copy native module files (.h and .m)
    if (fs.existsSync(sourceNativeFilesPath)) {
      const files = fs.readdirSync(sourceNativeFilesPath);
      
      files.forEach(file => {
        if (file.endsWith('.h') || file.endsWith('.m')) {
          const sourcePath = path.join(sourceNativeFilesPath, file);
          const targetPath = path.join(targetDir, file);
          
          let content = fs.readFileSync(sourcePath, 'utf8');
          
          // Replace any project name placeholders
          content = content.replace(/YourProjectName/g, projectName);
          
          fs.writeFileSync(targetPath, content);
          console.log(`✅ Copied ${file}`);
        }
      });
    } else {
      console.log('ℹ️  No template-files/ios directory found, using embedded module files');
      
      // Create the native module files directly
      createNativeModuleFiles(targetDir, projectName);
    }
    // createBridgingHeader(targetDir, projectName);

    // Update Podfile if needed
    updatePodfileForDependencies(platformProjectRoot);

    console.log('🎉 iOS setup completed successfully!');
    
  } catch (error) {
    console.error('❌ iOS setup failed:', error.message);
    throw error;
  }
}

/**
 * Create native module files directly (fallback)
 */
function createNativeModuleFiles(targetDir, projectName) {
  
  // HeimanBluetoothModule.h
  const headerContent = `#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface HeimanBluetoothModule : RCTEventEmitter <RCTBridgeModule>

@end`;

  // HeimanBluetoothModule.m  
  const implementationContent = `#import "HeimanBluetoothModule.h"
#import <HmDeviceCenter/HmDeviceCenter.h>

@implementation HeimanBluetoothModule {
    HmDeviceManagerCenter *deviceManager;
    RCTPromiseResolveBlock currentConfigResolve;
    RCTPromiseRejectBlock currentConfigReject;
    BOOL hasListeners;
}

RCT_EXPORT_MODULE(HeimanBluetooth);

+ (BOOL)requiresMainQueueSetup {
    return YES;
}

- (instancetype)init {
    self = [super init];
    if (self) {
        deviceManager = [HmDeviceManagerCenter shard];
        hasListeners = NO;
    }
    return self;
}

- (NSArray<NSString *> *)supportedEvents {
    return @[@"onDeviceDiscovered", @"onDeviceFound", @"onConfigStep", @"onConfigError"];
}

- (void)startObserving {
    hasListeners = YES;
}

- (void)stopObserving {
    hasListeners = NO;
}

RCT_EXPORT_METHOD(startDiscovery:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            [self->deviceManager initBluetooth];
            
            HmCBState bluetoothState = [self->deviceManager getBluetoothCurrentStatus];
            if (bluetoothState != HmCBStateOn) {
                reject(@"BLUETOOTH_ERROR", @"Bluetooth is not enabled", nil);
                return;
            }
            
            [self->deviceManager startBluetoothDiscovery:^(NSArray<HmProductModel *> * _Nonnull devices, HmCBState state) {
                if (state == HmCBStateOn && devices.count > 0) {
                    for (HmProductModel *device in devices) {
                        if (self->hasListeners) {
                            [self sendEventWithName:@"onDeviceDiscovered" body:@{
                                @"productId": device.Id ?: @"",
                                @"mac": device.mac ?: @"",
                                @"name": device.name ?: @"",
                                @"photoUrl": device.photoUrl ?: @""
                            }];
                        }
                    }
                }
            }];
            
            resolve(@"Discovery started successfully");
            
        } @catch (NSException *exception) {
            reject(@"DISCOVERY_ERROR", exception.reason, nil);
        }
    });
}

RCT_EXPORT_METHOD(stopDiscovery:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            [self->deviceManager stopBluetoothDiscovery];
            resolve(@"Discovery stopped successfully");
        } @catch (NSException *exception) {
            reject(@"STOP_ERROR", exception.reason, nil);
        }
    });
}

RCT_EXPORT_METHOD(configureDevice:(NSDictionary *)configData
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            self->currentConfigResolve = resolve;
            self->currentConfigReject = reject;
            
            NSString *ssid = configData[@"ssid"];
            NSString *password = configData[@"password"];
            NSString *productId = configData[@"productId"];
            
            if (!ssid || !password) {
                reject(@"CONFIG_ERROR", @"SSID and password are required", nil);
                return;
            }
            
            [self->deviceManager setWifiInfoWithSsid:ssid PassWord:password];
            
            [self->deviceManager startBluetoothDiscovery:^(NSArray<HmProductModel *> * _Nonnull devices, HmCBState state) {
                if (state == HmCBStateOn && devices.count > 0) {
                    HmProductModel *targetDevice = devices.firstObject;
                    [self configureFoundDevice:targetDevice];
                }
            }];
            
        } @catch (NSException *exception) {
            reject(@"CONFIG_ERROR", exception.reason, nil);
        }
    });
}

RCT_EXPORT_METHOD(stopConfiguration:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    
    dispatch_async(dispatch_get_main_queue(), ^{
        [self->deviceManager stopBluetoothDiscovery];
        
        if (self->currentConfigReject) {
            self->currentConfigReject(@"CONFIG_CANCELLED", @"Configuration was cancelled", nil);
            self->currentConfigResolve = nil;
            self->currentConfigReject = nil;
        }
        
        resolve(@"Configuration stopped successfully");
    });
}

- (void)configureFoundDevice:(HmProductModel *)device {
    if (hasListeners) {
        [self sendEventWithName:@"onDeviceFound" body:nil];
    }
    
    [deviceManager connectBluetoothDeviceWithProductModel:device completion:^(HmCBManagerState state) {
        
        if (self->hasListeners) {
            [self sendEventWithName:@"onConfigStep" body:@{
                @"step": @((int)state),
                @"stepName": [self getStepName:state]
            }];
        }
        
        if (state == HmCBManagerStateServerSuccess) {
            if (self->currentConfigResolve) {
                self->currentConfigResolve(@{
                    @"result": @"success",
                    @"mac": device.mac ?: @"",
                    @"productId": device.Id ?: @""
                });
                self->currentConfigResolve = nil;
                self->currentConfigReject = nil;
            }
        } else if (state == HmCBManagerStateConnectFail || 
                   state == HmCBManagerStateSendDataFail ||
                   state == HmCBManagerStateServerFail) {
            if (self->currentConfigReject) {
                self->currentConfigReject(@"CONFIG_FAILED", [self getErrorMessage:state], nil);
                self->currentConfigResolve = nil;
                self->currentConfigReject = nil;
            }
        }
    }];
}

- (NSString *)getStepName:(HmCBManagerState)state {
    switch (state) {
        case HmCBManagerStateConnecting: return @"CONNECT_DEVICE";
        case HmCBManagerStateSendDataing: return @"SEND_DATA";
        case HmCBManagerStateServering: return @"WAIT_DEVICE_CONNECT_NET";
        case HmCBManagerStateServerSuccess: return @"DEVICE_CONNECT_NET_SUCCEED";
        default: return @"UNKNOWN_STEP";
    }
}

- (NSString *)getErrorMessage:(HmCBManagerState)state {
    switch (state) {
        case HmCBManagerStateConnectFail: return @"Failed to connect to device";
        case HmCBManagerStateSendDataFail: return @"Failed to send configuration data";
        case HmCBManagerStateServerFail: return @"Device failed to connect to server";
        default: return @"Unknown error occurred";
    }
}

@end`;

  // Write files
  fs.writeFileSync(path.join(targetDir, 'HeimanBluetoothModule.h'), headerContent);
  fs.writeFileSync(path.join(targetDir, 'HeimanBluetoothModule.m'), implementationContent);
  
  console.log('✅ Created HeimanBluetoothModule.h');
  console.log('✅ Created HeimanBluetoothModule.m');
}

/**
 * Update Podfile to include required dependencies
 */
function updatePodfileForDependencies(platformProjectRoot) {
  const podfilePath = path.join(platformProjectRoot, 'Podfile');
  
  if (fs.existsSync(podfilePath)) {
    let podfileContent = fs.readFileSync(podfilePath, 'utf8');
    
    const dependencies = `
  # Heiman Bluetooth Dependencies
  pod 'CocoaAsyncSocket', '7.6.5'
  pod 'GTMBase64'
`;
    
    if (!podfileContent.includes('CocoaAsyncSocket')) {
      // Add before the end of target block
      podfileContent = podfileContent.replace(
        /(\s+)end(\s*)$/m,
        `$1${dependencies}$1end$2`
      );
      
      fs.writeFileSync(podfilePath, podfileContent);
      console.log('✅ Updated Podfile with Heiman dependencies: CocoaAsyncSocket 7.6.5, GTMBase64');
    }
  }
}

/**
 * Recursively copy directory
 */
function copyDirectoryRecursive(source, target) {
  if (!fs.existsSync(target)) {
    fs.mkdirSync(target, { recursive: true });
  }
  
  const items = fs.readdirSync(source);
  
  items.forEach(item => {
    const sourcePath = path.join(source, item);
    const targetPath = path.join(target, item);
    
    if (fs.statSync(sourcePath).isDirectory()) {
      copyDirectoryRecursive(sourcePath, targetPath);
    } else {
      fs.copyFileSync(sourcePath, targetPath);
    }
  });
}

module.exports = withHeimanBluetoothIOS;