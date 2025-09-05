//
//  HmProductManager.h
//  HmModel
//
//  Created by HeiManRd29 on 2024/11/20.
//

#import <Foundation/Foundation.h>

NS_ASSUME_NONNULL_BEGIN

@interface HmProductManager : NSObject

/// 获取海曼产品列表
/// - Parameter productList: 海曼产品列表
+ (void)getLocalProductList:(void (^)(NSArray<HmProductModel *> *))productList;

/// 根据海曼产品id获取海曼产品
/// - Parameter productId: 海曼产品Id
+ (HmProductModel *)createProductModelWithProductId:(NSString *)productId;

@end

NS_ASSUME_NONNULL_END
