//
//  HmDeviceManagerCenter.h
//  HmDeviceCenter
//
//  Created by HeiManRd29 on 2024/11/25.
//

#import <Foundation/Foundation.h>
#import <HmDeviceCenter/HmProductManager.h>
#import <HmDeviceCenter/HmDeviceCenterState.h>
NS_ASSUME_NONNULL_BEGIN

@interface HmDeviceManagerCenter : NSObject

/// 单例
+ (instancetype)shard;

/// 启动蓝牙辅助配网或热点配网前，需要先输入Wi-Fi名称和Wi-Fi密码
/// - Parameters:
///   - ssid: Wi-Fi名称
///   - password: Wi-Fi密码
- (void)setWifiInfoWithSsid:(NSString *)ssid PassWord:(NSString *)password;

// 蓝牙辅助配网

/// 初始化蓝牙
- (void)initBluetooth;

/// 当前蓝牙状态
- (HmCBState)getBluetoothCurrentStatus;

/// 开启蓝牙扫描
/// - Parameter didFoundBlock:(devices：扫描到的产品列表，state：蓝牙状态)
- (void)startBluetoothDiscovery:(void(^)(NSArray<HmProductModel *> * devices, HmCBState state))didFoundBlock;

/// 使用蓝牙给产品进行配网
/// - Parameters:
///   - productModel: 需要蓝牙辅助配网的产品
///   - connectDeviceBlock: 蓝牙配网过程中的状态
- (void)connectBluetoothDeviceWithProductModel:(HmProductModel *)productModel completion:(void (^)(HmCBManagerState))connectDeviceBlock;

/// 关闭蓝牙扫描
- (void)stopBluetoothDiscovery;

@end

NS_ASSUME_NONNULL_END
