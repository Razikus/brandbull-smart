
import aiohttp



class HeimanConnector:
    def __init__(self, spapiurl: str, clientId: str, clientSecret: str):
        self.spapiurl = spapiurl
        self.clientId = clientId
        self.clientSecret = clientSecret
        self.defaultHeaders = {
            "user-agent": "SH-API/1.0.0",
        }

    def user_id_to_tenant_id(self, user_id: str) -> str:
        return "SH_" + user_id

    async def nameByDevice(self, userID: str, productID: str, macadress: str):
        consolidatedHeaders = self.defaultHeaders.copy()
        consolidatedHeaders["Tenant-Id"] = self.user_id_to_tenant_id(userID)
        async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.spapiurl}/api-saas/device-instance/{productID}/{macadress}/nameByDevice", headers=consolidatedHeaders) as device_response:
                    device_loaded = await device_response.json()
                    return device_loaded

    async def getDeviceIDDetail(self, userID: str, deviceID: str):
        consolidatedHeaders = self.defaultHeaders.copy()
        consolidatedHeaders["Tenant-Id"] = self.user_id_to_tenant_id(userID)

        async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.spapiurl}/api-saas/device-instance/{deviceID}/detail", headers=consolidatedHeaders) as device_response:
                    device_loaded = await device_response.json()
                    return device_loaded

    async def getDeviceEvents(self, userID: str, deviceID: str, pageSize: int = 5):
        consolidatedHeaders = self.defaultHeaders.copy()
        consolidatedHeaders["Tenant-Id"] = self.user_id_to_tenant_id(userID)
        async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.spapiurl}/api-saas/device-instance/{deviceID}/logs", headers=consolidatedHeaders, json= {
                    "pageIndex": 0,
                    "pageSize": 5,
                    "terms": [
                        {
                            "type": "or",
                            "value": "event",
                            "termType": "eq",
                            "column": "type"
                        }
                    ]
                }) as device_response:
                    device_loaded = await device_response.json()
                    return device_loaded

    async def getDeviceProperties(self, userID: str, deviceID: str, pageSize: int = 5):
        consolidatedHeaders = self.defaultHeaders.copy()
        consolidatedHeaders["Tenant-Id"] = self.user_id_to_tenant_id(userID)
        async with aiohttp.ClientSession() as session:
            async with session.post(f"{self.spapiurl}/api-saas/device-instance/{deviceID}/logs",
                                    headers=consolidatedHeaders, json={
                        "pageIndex": 0,
                        "pageSize": 5,
                        "terms": [
                            {
                                "type": "and",
                                "value": "reportProperty",
                                "termType": "eq",
                                "column": "type"
                            }
                        ]
                    }) as device_response:
                device_loaded = await device_response.json()
                return device_loaded



    async def unbind(self, userID: str, deviceID: str):
        consolidatedHeaders = self.defaultHeaders.copy()
        consolidatedHeaders["Tenant-Id"] = self.user_id_to_tenant_id(userID)
        async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.spapiurl}/api-saas/sys/user/device/unbind", headers=consolidatedHeaders, json = {
                    "deviceId": deviceID,
                    "userId": consolidatedHeaders["Tenant-Id"],
                    "tenantId": consolidatedHeaders["Tenant-Id"],
                }) as response:
                    returnLoaded = await response.json()
                    return returnLoaded

    async def bind(self, userID: str, deviceID: str):
        consolidatedHeaders = self.defaultHeaders.copy()
        consolidatedHeaders["Tenant-Id"] = self.user_id_to_tenant_id(userID)
        async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.spapiurl}/api-saas/sys/user/device/bind", headers=consolidatedHeaders, json = {
                    "deviceId": deviceID,
                    "userId": consolidatedHeaders["Tenant-Id"],
                    "tenantId": consolidatedHeaders["Tenant-Id"],
                }) as response:
                    returnLoaded = await response.json()
                    return returnLoaded


    async def deviceList(self, userID: str):

        consolidatedHeaders = self.defaultHeaders.copy()
        consolidatedHeaders["Tenant-Id"] = self.user_id_to_tenant_id(userID)
        async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.spapiurl}/api-saas/sys/user/device/list/_query", headers=consolidatedHeaders, json = {
                    "help": {
                        "pageIndex": 0,
                        "pageSize": 50
                    },
                    "custom": {
                        "userId": consolidatedHeaders["Tenant-Id"],
                        "tenantId": consolidatedHeaders["Tenant-Id"],

                    }
                }) as device_response:
                    device_loaded = await device_response.json()
                    return device_loaded



    async def queryDevice(self, userID: str, productID: str, name: str):
        consolidatedHeaders = self.defaultHeaders.copy()
        consolidatedHeaders["Tenant-Id"] = self.user_id_to_tenant_id(userID)
        async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.spapiurl}/api-saas/device/instance/_query", json={
                    "pageIndex": 0,
                    "pageSize": 50,
                    "terms": [
                        {
                            "column": "productId",
                            "value": productID,
                            "termType": "eq"
                        },
                        {
                            "column": "name",
                            "value": name,
                            "termType": "eq"
                        }
                    ]
                }, headers=consolidatedHeaders) as device_response:
                    device_loaded = await device_response.json()
                    return device_loaded["result"]["data"]