//
//  HmProductModel.h
//  HmDeviceCenter
//
//  Created by HeiManRd29 on 2024/11/22.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface HmProductModel : NSObject
/**
 通用属性
 */
@property (nonatomic, copy) NSString * Id;                 //产品id
@property (nonatomic, copy) NSString * name;               //产品名称
@property (nonatomic, copy) NSString * photoUrl;           //产品图片
@property (nonatomic, assign) NSInteger state;             //1正常,0禁用
@property (nonatomic, copy) NSString * deviceType;         //网关:gateway、网关子设备:childrenDevice、直连设备:device
@property (nonatomic, copy) NSString * mac;                //设备mac

- (instancetype)initWithDictionary:(NSDictionary *)dictionary;

@end

NS_ASSUME_NONNULL_END
