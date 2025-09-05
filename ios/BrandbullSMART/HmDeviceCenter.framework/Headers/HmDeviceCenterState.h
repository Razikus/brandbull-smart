//
//  HmDeviceCenterState.h
//  HmDeviceCenter
//
//  Created by HeiManRd29 on 2024/11/26.
//

#ifndef HmDeviceCenterState_h
#define HmDeviceCenterState_h


#endif /* HmDeviceCenterState_h */

// 蓝牙状态
typedef NS_ENUM(NSInteger, HmCBState) {
    HmCBStateUnknown = 0,       //未知错误
    HmCBStateResetting,         //重置
    HmCBStateUnsupported,       //不支持
    HmCBStateUnauthorized,      //未经授权
    HmCBStateOff,               //关闭
    HmCBStateOn,                //开启
};

// 蓝牙操作状态
typedef NS_ENUM(NSInteger, HmCBManagerState) {
    HmCBManagerStateConnecting = 0,   //蓝牙连接中
    HmCBManagerStateConnectFail,      //蓝牙连接失败
    HmCBManagerStateConnectSuccess,   //蓝牙连接成功
    HmCBManagerStateSendDataing,      //数据发送中
    HmCBManagerStateSendDataFail,     //数据发送失败
    HmCBManagerStateSendDataSuccess,  //数据发送成功
    HmCBManagerStateServering,        //设备连接服务器中
    HmCBManagerStateServerFail,       //设备连接服务器失败
    HmCBManagerStateServerSuccess,    //设备连接服务器成功
    HmCBManagerStateWiFiMissing,      //Wi-Fi信息缺失
};

// 局域网添加设备操作状态
typedef NS_ENUM(NSInteger, HmLanManagerState) {
    HmLanManagerStateSearching = 0,    //搜索设备中
    HmLanManagerStateSearchFail,       //搜索设备失败
    HmLanManagerStateSearchSuccess,    //搜索设备成功
    HmLanManagerStateSendDataing,      //数据发送中
    HmLanManagerStateSendDataFail,     //数据发送失败
    HmLanManagerStateSendDataSuccess,  //数据发送成功
    HmLanManagerStateServering,        //设备连接服务器中
    HmLanManagerStateServerFail,       //设备连接服务器失败
    HmLanManagerStateServerSuccess,    //设备连接服务器成功
    HmLanManagerStateRunFail,          //SDK初始化失败
    HmLanManagerStateRunSuccess,       //SDK初始化成功
};

// 热点添加设备操作状态
typedef NS_ENUM(NSInteger, HmHotManagerState) {
    HmHotManagerStateWiFiMissing = 0,  //Wi-Fi信息缺失
    HmHotManagerStateSearchFail,       //搜索设备失败
    HmHotManagerStateSearchSuccess,    //搜索到设备
    HmHotManagerStateConnecting,       //设备连接中
    HmHotManagerStateConnectFail,      //设备连接失败
    HmHotManagerStateConnectSuccess,   //连接到设备
    HmHotManagerStateSendDataing,      //数据发送中
    HmHotManagerStateSendDataFail,     //数据发送失败
    HmHotManagerStateSendDataSuccess,  //数据发送成功
    HmHotManagerStateServering,        //设备连接服务器中
    HmHotManagerStateServerFail,       //设备连接服务器失败
    HmHotManagerStateServerSuccess,    //设备连接服务器成功
    HmHotManagerStateRunFail,          //SDK初始化失败
    HmHotManagerStateRunSuccess        //SDK初始化成功
};
