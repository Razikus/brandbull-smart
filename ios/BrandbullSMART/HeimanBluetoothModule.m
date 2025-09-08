#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <HmDeviceCenter/HmDeviceCenter.h>

@interface HeimanBluetoothModule : RCTEventEmitter <RCTBridgeModule>

@end

@implementation HeimanBluetoothModule {
    HmDeviceManagerCenter *deviceManager;
    RCTPromiseResolveBlock currentConfigResolve;
    RCTPromiseRejectBlock currentConfigReject;
    BOOL hasListeners;
    NSMutableArray<NSDictionary *> *cachedDevices;
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
        NSLog(@"🔵 HeimanBluetoothModule initialized");
        cachedDevices = [NSMutableArray new];
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
            NSLog(@"🔵 Initializing Bluetooth...");
            // Initialize Bluetooth if not already done
            HmCBState bluetoothState = [self->deviceManager getBluetoothCurrentStatus];
            if (bluetoothState != HmCBStateOn) {
              [self->deviceManager initBluetooth];
            }
            
            // Add 1-second delay to let Bluetooth initialize properly
            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 3.0 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
                
                // Check Bluetooth status after delay
                HmCBState bluetoothState = [self->deviceManager getBluetoothCurrentStatus];
                NSLog(@"🔵 Bluetooth state after delay: %ld", (long)bluetoothState);
                
                if (bluetoothState != HmCBStateOn) {
                    NSLog(@"❌ Bluetooth not enabled, state: %ld", (long)bluetoothState);
                    reject(@"BLUETOOTH_ERROR", @"Bluetooth is not enabled", nil);
                    return;
                }
                dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 0.5 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{
                    NSLog(@"🔵 About to send cached devices. Cache count: %lu", (unsigned long)self->cachedDevices.count);
                    
                    for (NSDictionary *cachedDevice in self->cachedDevices) {
                        NSLog(@"🔵 Sending cached device: %@", cachedDevice);
                        if (self->hasListeners) {
                            [self sendEventWithName:@"onDeviceDiscovered" body:cachedDevice];
                        }
                    }
                });

                
                NSLog(@"🔵 Starting Bluetooth discovery...");
                // Start discovery
                [self->deviceManager startBluetoothDiscovery:^(NSArray<HmProductModel *> * _Nonnull devices, HmCBState state) {
                    NSLog(@"🔵 Discovery callback - state: %ld, devices count: %lu", (long)state, (unsigned long)devices.count);
                    NSLog(@"🔵 Devices: %@", devices);

                    
                    if (state == HmCBStateOn && devices.count > 0) {
                        for (HmProductModel *device in devices) {
                            BOOL alreadyCached = NO;
                            NSString *currentMac = device.mac;
                            
                            for (NSDictionary *cached in self->cachedDevices) {
                                if ([cached[@"mac"] isEqualToString:currentMac]) {
                                    alreadyCached = YES;
                                    break;
                                }
                            }
                            NSLog(@"🔵 Discovered device: %@ %@ %@ %ld %@ %@", device.Id, device.name, device.photoUrl, (long)device.state, device.deviceType, device.mac);

                            
                            if (self->hasListeners) {
                                [self sendEventWithName:@"onDeviceDiscovered" body:@{
                                    @"productId": device.Id ?: @"",
                                    @"mac": device.mac ?: @"",
                                    @"name": device.name ?: @"",
                                    @"photoUrl": device.photoUrl ?: @""
                                }];
                            }
                            if (!alreadyCached) {
                                NSDictionary *cachedDevice = @{
                                    @"productId": device.Id ?: @"",
                                    @"mac": device.mac ?: @"",
                                    @"name": device.name ?: @"",
                                    @"photoUrl": device.photoUrl ?: @""
                                };
                                
                                [self->cachedDevices addObject:cachedDevice];
                                NSLog(@"🟢 ADDED TO CACHE: %@ - Total cached devices: %lu", currentMac, (unsigned long)self->cachedDevices.count);
                                
                                for (int j = 0; j < self->cachedDevices.count; j++) {
                                    NSDictionary *cached = self->cachedDevices[j];
                                    NSLog(@"🟢 Cached[%d]: %@", j, cached);
                                }
                                
                                if (self->hasListeners) {
                                    [self sendEventWithName:@"onDeviceDiscovered" body:cachedDevice];
                                }
                            }
                        }
                    } else if (state != HmCBStateOn) {
                        NSLog(@"❌ Bluetooth state changed during discovery: %ld", (long)state);
                        return;
                    } else {
                        NSLog(@"ℹ️ Discovery running, no devices found yet");
                    }
                }];
                
                resolve(@"Discovery started successfully");
            });
            
        } @catch (NSException *exception) {
            NSLog(@"❌ Discovery exception: %@", exception.reason);
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
    NSLog(@"configureDevice called with configData: %@", configData);
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            NSLog(@"🔵 Initializing Bluetooth...");
            // Store promise callbacks
            self->currentConfigResolve = resolve;
            self->currentConfigReject = reject;
            
            // Extract configuration data
            NSString *ssid = configData[@"ssid"];
            NSString *password = configData[@"password"];
            NSString *productId = configData[@"productId"];
            NSString *deviceMac = configData[@"deviceMac"];
            NSString *hostUrl = configData[@"hostUrl"];
            NSString *mqttURL = configData[@"mqttUrl"];

            NSLog(@"🔵 Configuration Data: SSID=%@, Password=%@, ProductID=%@", ssid, password, productId);
            
            if (!ssid || !password) {
                NSLog(@"❌ SSID or password missing");
                reject(@"CONFIG_ERROR", @"SSID and password are required", nil);
                return;
            }
            
            NSLog(@"🔵 Initializing Bluetooth...");
            // Initialize Bluetooth if not already done
            HmCBState bluetoothState = [self->deviceManager getBluetoothCurrentStatus];
            if (bluetoothState != HmCBStateOn) {
              [self->deviceManager initBluetooth];
            }
            // Start discovery to find the specific device
            NSLog(@"🔵 Starting Bluetooth discovery for configuration...");

            dispatch_after(dispatch_time(DISPATCH_TIME_NOW, 3 * NSEC_PER_SEC), dispatch_get_main_queue(), ^{

                HmCBState bluetoothState = [self->deviceManager getBluetoothCurrentStatus];
                NSLog(@"🔵 Bluetooth state after delay: %ld", (long)bluetoothState);
                
                if (bluetoothState != HmCBStateOn) {
                    NSLog(@"❌ Bluetooth not enabled, state: %ld", (long)bluetoothState);
                    reject(@"BLUETOOTH_ERROR", @"Bluetooth is not enabled", nil);
                    return;
                }
                // Set WiFi info
                NSLog(@"🔵 Discovery started for configuration");

                // create hm product
                HmProductModel *product = [[HmProductModel alloc] init];
                product.Id = productId;
                product.name = @"烟雾报警器WS2SA-5-H";
                product.photoUrl = @"https://spapi.heiman.cn/api-saas/file/01bd3544822c52ec1cd1451ed250d8d1.jpg?accessKey=0044c060a6f97f983822766c94552aac";
                product.state = 1;
                product.deviceType = @"device";
                product.mac = deviceMac;

                // setWifiInfoWithSsid
                [self->deviceManager setWifiInfoWithSsid:ssid PassWord:password];
                // wartość domyślna	14:21:33.795149+0200	BrandbullSMART	🔵 Discovered device: 1905532161226346496 烟雾报警器WS2SA-5-H https://spapi.heiman.cn/api-saas/file/01bd3544822c52ec1cd1451ed250d8d1.jpg?accessKey=0044c060a6f97f983822766c94552aac 1 device 4055481e5d65


                [self configureFoundDevice:product];


                // [self->deviceManager startBluetoothDiscovery:^(NSArray<HmProductModel *> * _Nonnull devices, HmCBState state) {
                    // NSLog(@"🔵 Discovery callback during configuration - state: %ld, devices count: %lu", (long)state, (unsigned long)devices.count);
                    // if (state == HmCBStateOn && devices.count > 0) {
                        
                        // HmProductModel *targetDevice = nil;
                        
                        // Find device by productId if specified
                    //     NSLog(@"🔵 Looking for target device with ProductID: %@", productId);
                    //     if (productId && productId.length > 0) {
                    //         for (HmProductModel *device in devices) {
                    //             if ([device.Id isEqualToString:productId]) {
                    //                 targetDevice = device;
                    //                 break;
                    //             }
                    //         }
                    //     } else {
                    //         // Take first device if no specific productId
                    //         targetDevice = devices.firstObject;
                    //     }
                    //     NSLog(@"🔵 Target device found: %@", targetDevice ? targetDevice.mac : @"None");
                        
                    //     if (targetDevice) {
                    //         [self configureFoundDevice:targetDevice];
                    //     } else {
                    //         reject(@"DEVICE_NOT_FOUND", @"Target device not found", nil);
                    //     }
                    // } else {
                    //     reject(@"BLUETOOTH_ERROR", @"Failed to discover devices", nil);
                    // }
                // }];
            });            
        } @catch (NSException *exception) {
            reject(@"CONFIG_ERROR", exception.reason, nil);
        }
        
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
        
        switch (state) {
            case HmCBManagerStateConnecting:
                // Still in progress, no action needed
                break;
                
            case HmCBManagerStateConnectSuccess:
                // Continue to next step
                break;
                
            case HmCBManagerStateSendDataSuccess:
                // Data sent successfully, wait for server connection
                break;
                
            case HmCBManagerStateServerSuccess:
                // Configuration completed successfully
                if (self->currentConfigResolve) {
                    self->currentConfigResolve(@{
                        @"result": @"success",
                        @"mac": device.mac ?: @"",
                        @"productId": device.Id ?: @""
                    });
                    self->currentConfigResolve = nil;
                    self->currentConfigReject = nil;
                }
                break;
                
            case HmCBManagerStateConnectFail:
            case HmCBManagerStateSendDataFail:
            case HmCBManagerStateServerFail:
                // Configuration failed
                if (self->hasListeners) {
                    [self sendEventWithName:@"onConfigError" body:@{
                        @"code": @((int)state),
                        @"message": [self getErrorMessage:state]
                    }];
                }
                
                if (self->currentConfigReject) {
                    self->currentConfigReject(@"CONFIG_FAILED", [self getErrorMessage:state], nil);
                    self->currentConfigResolve = nil;
                    self->currentConfigReject = nil;
                }
                break;
                
            case HmCBManagerStateWiFiMissing:
                // WiFi credentials missing
                if (self->currentConfigReject) {
                    self->currentConfigReject(@"WIFI_MISSING", @"WiFi credentials are required", nil);
                    self->currentConfigResolve = nil;
                    self->currentConfigReject = nil;
                }
                break;
                
            default:
                break;
        }
    }];
}

RCT_EXPORT_METHOD(stopConfiguration:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject) {
    
    dispatch_async(dispatch_get_main_queue(), ^{
        @try {
            [self->deviceManager stopBluetoothDiscovery];
            
            // Cancel any pending promises
            if (self->currentConfigReject) {
                self->currentConfigReject(@"CONFIG_CANCELLED", @"Configuration was cancelled", nil);
                self->currentConfigResolve = nil;
                self->currentConfigReject = nil;
            }
            
            resolve(@"Configuration stopped successfully");
            
        } @catch (NSException *exception) {
            reject(@"STOP_CONFIG_ERROR", exception.reason, nil);
        }
    });
}

- (NSString *)getStepName:(HmCBManagerState)state {
    switch (state) {
        case HmCBManagerStateConnecting:
            return @"CONNECT_DEVICE";
        case HmCBManagerStateConnectSuccess:
            return @"CONNECT_SUCCESS";
        case HmCBManagerStateSendDataing:
            return @"SEND_DATA";
        case HmCBManagerStateSendDataSuccess:
            return @"SEND_DATA_SUCCESS";
        case HmCBManagerStateServering:
            return @"WAIT_DEVICE_CONNECT_NET";
        case HmCBManagerStateServerSuccess:
            return @"DEVICE_CONNECT_NET_SUCCEED";
        default:
            return @"UNKNOWN_STEP";
    }
}

- (NSString *)getErrorMessage:(HmCBManagerState)state {
    switch (state) {
        case HmCBManagerStateConnectFail:
            return @"Failed to connect to device";
        case HmCBManagerStateSendDataFail:
            return @"Failed to send configuration data";
        case HmCBManagerStateServerFail:
            return @"Device failed to connect to server";
        case HmCBManagerStateWiFiMissing:
            return @"WiFi credentials are missing";
        default:
            return @"Unknown error occurred";
    }
}

@end
