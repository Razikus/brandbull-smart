import requests
import json
import hashlib
from typing import Optional, Dict, List, Any
from datetime import datetime
import time
import sys

def exit():
    sys.exit(0)

def main():
    APP_ID = "SB7sFDXHe3WQyF7k"
    SECURE_KEY = "K2rDXbNbF3hfc3Z7RDXPmYHGm54b6fCD"
    base_url = "https://spapi.heiman.cn"

    #1905532161226346496

    response = requests.post("https://spapi.heiman.cn/api-auth/system/auth/oauth2/token", json={
        "clientId": APP_ID,
        "clientSecret": SECURE_KEY,
        "grantTypes": "client_credentials",
        "oauthTimestamp": str(int(time.time() * 1000))
    })
    loaded = json.loads(response.text)
    result = loaded["result"]
    access_token = result["access_token"]
    tenant_id = result["tenantId"]
    user_id = result["userId"]

    print(access_token)
    print(tenant_id)

    productId = "1905532161226346496"
    macadress = "4055481e5d6b"

    defaultheaders = {
        "user-agent": "SH-API/1.0.0",
        "Tenant-Id": tenant_id,
    }
#
    c  = requests.post(f"{base_url}/api-saas/device/instance/_query", json={
    "pageIndex": 0,
    "pageSize": 50,
    "terms": [
        {
            "column": "productId",
            "value": productId,
            "termType": "eq"
        },
        {
            "column": "name",
            "value": "4055481e5d6b",
            "termType": "eq"
        }
    ]
}, headers=defaultheaders)
    loaded = json.loads(c.text)
    for item in loaded["result"]["data"]:
        print(item)


    aaa = requests.get(f"{base_url}/api-saas/device-instance/{productId}/{macadress}/nameByDevice", headers=defaultheaders)
    loaded = json.loads(aaa.text)
    resultOf = loaded["result"]
    print(resultOf[0])

    deviceId = resultOf[0]["id"]
    print("DEVID", deviceId)

    secureId = resultOf[0]["configuration"]["secureId"]
    print(resultOf[0])

    c = requests.post(f"{base_url}/api-saas/sys/user/device/list/_query", json = {
        "help": {
            "pageIndex": 0,
            "pageSize": 50
        },
        "custom": {
            "userId": user_id,
            "tenantId": tenant_id,

        }
    }, headers=defaultheaders)
    loaded = json.loads(c.text)
    print(loaded)

    # c = requests.post(f"{base_url}/api-saas/device-instance/{deviceId}/logs", json={
    #     "pageIndex": 0,
    #     "pageSize": 50,
    #     "sorts": [
    #         {
    #             "name": "timestamp",
    #             "order": "desc"
    #         }
    #     ],
    #     "terms": [
    #         {
    #             "terms": [
    #                 {
    #                     "type": "or",
    #                     "value": "reportProperty",
    #                     "termType": "eq",
    #                     "column": "type"
    #                 },
    #                 {
    #                     "type": "or",
    #                     "value": "event",
    #                     "termType": "eq",
    #                     "column": "type"
    #                 }
    #             ]
    #         }
    #     ]
    # }, headers=defaultheaders)

    loaded = json.loads(c.text)
    print(loaded)



    unbindR = requests.post(f"{base_url}/api-saas/sys/user/device/unbind", json = {
        "deviceId": deviceId,
        "userId": user_id,
        "tenantId": tenant_id,
    }, headers=defaultheaders)

    print(unbindR.text)

    unbindR = requests.post(f"{base_url}/api-saas/sys/user/device/unbind", json = {
        "deviceId": secureId,
        "userId": user_id,
        "tenantId": tenant_id,
    }, headers=defaultheaders)

    print(unbindR.text)

    exit()


    b = requests.get(f"{base_url}/api-saas/device-instance/{deviceId}/detail", headers=defaultheaders)
    print(b.text)


    print (c.text)

    print(deviceId)

    # a = requests.post("https://spapi.heiman.cn/api-saas/sys/user/device/bind", json = {
    #     "deviceId": deviceId,
    #     "userId": user_id,
    #     "tenantId": tenant_id,
    # }, headers = {
    #     "user-agent": "SH-API/1.0.0",
    #     "Tenant-Id": tenant_id
    # })
    # # #
    # print(a.text)
    #
    # a = requests.post("https://spapi.heiman.cn/api-saas/sys/user/device/bind", json = {
    #     "deviceId": deviceId,
    #     "userId": user_id,
    #     "tenantId": tenant_id,
    # }, headers = {
    #     "user-agent": "SH-API/1.0.0",
    #     "Tenant-Id": tenant_id
    # })
    # # #
    # print(a.text)
    #
    #
    #
    # a = requests.post("https://spapi.heiman.cn/api-saas/sys/user/device/bind", json = {
    #     "deviceId": secureId,
    #     "userId": user_id,
    #     "tenantId": tenant_id,
    # }, headers = {
    #     "user-agent": "SH-API/1.0.0",
    #     "Tenant-Id": tenant_id
    # })
    # # #
    # print(a.text)
    #
    #
    # a = requests.post("https://spapi.heiman.cn/api-saas/sys/user/device/bind", json = {
    #     "deviceId": productId,
    #     "userId": user_id,
    #     "tenantId": tenant_id,
    # }, headers = {
    #     "user-agent": "SH-API/1.0.0",
    #     "Tenant-Id": tenant_id
    # })
    # # #
    # print(a.text)



if __name__ == "__main__":
    main()