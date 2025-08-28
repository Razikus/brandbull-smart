import os
from ast import parse

from fastapi import FastAPI, HTTPException, Depends, Security, Request, BackgroundTasks
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
import jwt  # PyJWT library
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import logging
from .supajwks.jwksclient import JWKSClient
import logging
from .heiman.heimanconnector import HeimanConnector
from pydantic import BaseModel, JsonValue
from .supaconnector.supaconnector import SupabaseDevicesClient
from typing import List
import json
from .notifier.notifier import processNotification, NotificationRequest, processEFlaraREQ, Address

from asyncio import sleep


class DeviceRegistrationRequest(BaseModel):
    deviceName: str
    productID: str

class DeviceUnRegistrationRequest(BaseModel):
    deviceUUID: str

class RegisterDeviceResponse(BaseModel):
    uuid: str
    name: str
    created_at: datetime

class ListReturnItem(BaseModel):
    created_at: datetime
    internal_uuid: str
    product_id: str
    name: Optional[str] = None

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
app = FastAPI(title="BrandbullSmart", version="1.0.0", description="From razniewski.eu with <3")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

security = HTTPBearer()
clientidheiman = os.getenv("HEIMAN_CLIENT_ID")
secretheiman = os.getenv("HEIMAN_CLIENT_SECRET")

heimanConnector = HeimanConnector("https://spapi.heiman.cn", clientidheiman, secretheiman)

JWKS_URL = "https://zjqohfcskeirutsezxua.supabase.co/auth/v1/.well-known/jwks.json"
CACHE_DURATION = 3600*4
jwks_client = JWKSClient(JWKS_URL, CACHE_DURATION)
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
SRK = os.getenv("SUPABASE_SERVICE_KEY")

supadevices = SupabaseDevicesClient("https://zjqohfcskeirutsezxua.supabase.co", SRK)

async def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> Dict[str, Any]:
    token = credentials.credentials

    try:
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        alg = unverified_header.get("alg")

        logger.debug(f"Token header: {unverified_header}")

        if not kid:
            raise HTTPException(status_code=401, detail="Token missing 'kid' in header")

        if alg == "HS256":
            if not SUPABASE_JWT_SECRET:
                raise HTTPException(
                    status_code=500,
                    detail="JWT secret not configured for HS256 tokens. Please set SUPABASE_JWT_SECRET environment variable."
                )

            payload = jwt.decode(
                token,
                SUPABASE_JWT_SECRET,
                algorithms=["HS256"],
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_iat": True,
                    "verify_aud": False,
                }
            )

            logger.debug(f"HS256 token verified successfully for user: {payload.get('sub', 'unknown')}")
            return payload

        elif alg in ["ES256", "RS256"]:
            signing_key = jwks_client.get_signing_key(kid)

            payload = jwt.decode(
                token,
                signing_key,
                algorithms=[alg],
                options={
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_iat": True,
                    "verify_aud": False,
                }
            )

            logger.debug(f"{alg} token verified successfully for user: {payload.get('sub', 'unknown')}")
            return payload
        else:
            raise HTTPException(status_code=401, detail=f"Unsupported algorithm: {alg}")

    except jwt.ExpiredSignatureError:
        logger.error("Token has expired")
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.InvalidTokenError as e:
        logger.error(f"Token validation failed: {e}")
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    except HTTPException:
        # Re-raise HTTP exceptions (like key not found)
        raise
    except Exception as e:
        logger.error(f"Unexpected error during token verification: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


# Dependency for protected routes
async def get_current_user(payload: Dict[str, Any] = Depends(verify_token)) -> Dict[str, Any]:
    """Get current user from token payload"""
    return {
        "user_id": payload.get("sub"),
        "email": payload.get("email"),
        "role": payload.get("role"),
        "payload": payload
    }

async def get_authenticated_user(payload: Optional[Dict[str, Any]] = Depends(verify_token)) -> str:
    if payload is None:
        raise HTTPException(status_code=401, detail="Not authenticated")

    role = payload.get("role")
    if role != "authenticated":
        raise HTTPException(status_code=403, detail="User is not authenticated")

    subOf = payload.get("sub")
    if not subOf:
        raise HTTPException(status_code=400, detail="Token missing 'sub' claim")
    return subOf


@app.post("/register_device")
async def register_device(req: DeviceRegistrationRequest, current_user: str = Depends(get_authenticated_user)):
    print(req, current_user)
    queried = await heimanConnector.nameByDevice(current_user, req.productID, req.deviceName)
    message = queried.get("message", None)
    if message == "success":
        result = queried["result"]
        if len(result) == 0:
            raise HTTPException(status_code=404, detail=f"DEVICE_NOT_FOUND")

        deviceID = result[0]["id"]
        already = await supadevices.check_device_exists_in_the_system(deviceID)
        if already:
            fetchedDevice = await supadevices.get_device_by_device_id(deviceID)
            user_id = fetchedDevice.get("user_id", None)
            if user_id is not None:
                unbinded = await heimanConnector.unbind(user_id, deviceID)
                unbindedmessage = unbinded.get("message", None)
                if unbindedmessage == "success":
                    removed = await supadevices.remove_device_from_user(user_id, deviceID)
                    already = await supadevices.check_device_exists_in_the_system(deviceID)

        if not already:
            binded = await heimanConnector.bind(current_user, deviceID)
            bindedmessage = binded.get("message", None)
            if bindedmessage == "success":
                created = await supadevices.add_device_for_user(current_user, deviceID, req.deviceName, req.productID)

                parsedTime = datetime.fromisoformat(created["created_at"].replace("Z", "+00:00"))
                return RegisterDeviceResponse(
                    created_at = parsedTime,
                    uuid =  created["uuid"],
                    name = created["name"]
                )
            else:
                raise HTTPException(status_code=500, detail=f"Failed to bind device: {binded.get('message', 'unknown error')}")

        else:
            raise HTTPException(status_code=400, detail=f"DEVICE_ALREADY_REGISTERED")

    else:
        raise HTTPException(status_code=404, detail=f"DEVICE_NOT_FOUND")

@app.post("/unregister_device")
async def unregister_device(req: DeviceRegistrationRequest, current_user: str = Depends(get_authenticated_user)):
    queried = await heimanConnector.nameByDevice(current_user, req.productID, req.deviceName)
    message = queried.get("message", None)
    if message == "success":
        result = queried["result"]
        if len(result) == 0:
            raise HTTPException(status_code=404, detail=f"DEVICE_NOT_FOUND")

        deviceID = result[0]["id"]
        already = await supadevices.check_device_exists_in_the_system(deviceID)
        if already:
            unbinded = await heimanConnector.unbind(current_user, deviceID)
            unbindedmessage = unbinded.get("message", None)
            if unbindedmessage == "success":
                removed = await supadevices.remove_device_from_user(current_user, deviceID)
                if removed:
                    return {"status": "success", "detail": "Device unregistered successfully"}
                else:
                    raise HTTPException(status_code=500, detail=f"Failed to remove device from user")
            else:
                raise HTTPException(status_code=500, detail=f"Failed to unbind device: {unbinded.get('message', 'unknown error')}")
        else:
            raise HTTPException(status_code=400, detail=f"DEVICE_NOT_REGISTERED")

    else:
        raise HTTPException(status_code=404, detail=f"DEVICE_NOT_FOUND")


@app.post("/unregister_device_by_uuid")
async def unregister_device(req: DeviceUnRegistrationRequest, current_user: str = Depends(get_authenticated_user)):
    device_info = await supadevices.get_device_by_uuid(current_user, req.deviceUUID)
    if device_info is None:
        raise HTTPException(status_code=404, detail="DEVICE_NOT_FOUND")

    device_id = device_info["internal_device_id"]
    product_id = device_info["internal_product_id"]
    unbinded = await heimanConnector.unbind(current_user, device_id)
    unbindedmessage = unbinded.get("message", None)
    if unbindedmessage == "success":
        removed = await supadevices.remove_device_from_user(current_user, device_id)
        if removed:
            return {"status": "success", "detail": "Device unregistered successfully"}
        else:
            raise HTTPException(status_code=500, detail=f"Failed to remove device from user")
    else:
        raise HTTPException(status_code=500, detail=f"Failed to unbind device: {unbinded.get('message', 'unknown error')}")


class Event(BaseModel):
    name: str
    timestamp: Optional[datetime]

class PropertyReport(BaseModel):
    properties: JsonValue
    timestamp: Optional[datetime]

class DeviceEvents(BaseModel):
    events: List[Event]
    properties: List[PropertyReport]

class eFlara(BaseModel):
    address: str
    enabled: bool

class DeviceInfo(BaseModel):
    state: str
    name: Optional[str]
    eFlara: Optional[eFlara] = None



class NotificationTokenRequest(BaseModel):
    token: str

@app.post("/user/notification")
async def add_notification_token(req: NotificationTokenRequest, current_user: str = Depends(get_authenticated_user)):
    if req.token == "":
        raise HTTPException(status_code=400, detail="TOKEN_MISSING")

    await supadevices.add_notification_token(current_user, req.token)
    return {"status": "success", "detail": "Token added successfully"}

@app.get("/device/{device_uuid}/info")
async def get_device_info(device_uuid: str, current_user: str = Depends(get_authenticated_user)) -> DeviceInfo:
    device_info = await supadevices.get_device_by_uuid(current_user, device_uuid)
    if device_info is None:
        raise HTTPException(status_code=404, detail="DEVICE_NOT_FOUND")

    detailed = await heimanConnector.getDeviceIDDetail(current_user, device_info["internal_device_id"])
    if detailed is None or detailed.get("message", None) != "success":
        raise HTTPException(status_code=404, detail="DEVICE_NOT_FOUND")
    detailed = detailed.get("result", {})
    deviceInfo = DeviceInfo(state="offline", name=device_info["name"], eFlara = None)
    stateOf = detailed.get("state", {})
    if stateOf.get("text", None) == "Online":
        deviceInfo.state = stateOf.get("value", "offline")

    eFlaraStatus = await supadevices.get_eflara_for_device(device_uuid)
    if eFlaraStatus is not None:
        deviceInfo.eFlara = eFlara(address=eFlaraStatus["address"], enabled=eFlaraStatus["enabled"])

    return deviceInfo

@app.post("/device/{device_uuid}/eflara")
async def set_eflara_status(device_uuid: str, req: eFlara, current_user: str = Depends(get_authenticated_user)):
    device_info = await supadevices.get_device_by_uuid(current_user, device_uuid)
    if device_info is None:
        raise HTTPException(status_code=404, detail="DEVICE_NOT_FOUND")

    await supadevices.set_eflara_for_device(device_uuid, req.address, req.enabled)
    return {"status": "success", "detail": "eFlara status updated successfully"}

@app.get("/device/{device_uuid}/logs")
async def get_device_info(device_uuid: str, current_user: str = Depends(get_authenticated_user)) -> DeviceEvents:
    device_info = await supadevices.get_device_by_uuid(current_user, device_uuid)
    if device_info is None:
        raise HTTPException(status_code=404, detail="DEVICE_NOT_FOUND")

    toRet = DeviceEvents(events=[], properties=[])

    logs = await heimanConnector.getDeviceEvents(current_user, device_info["internal_device_id"])
    if logs.get("message", None) == "success":
        result = logs.get("result", {})
        data = result.get("data", [])
        for entry in data:
            typeOf = entry.get("type", {})
            valueOf = typeOf.get("value", "")
            if valueOf == "event":
                contentOf = entry.get("content", "")
                try:
                    parsed = json.loads(contentOf)
                    eventName = parsed.get("event", "")
                    if eventName != "":
                        timestampOf = parsed.get("timestamp", -1)
                        parsedDate = None
                        if timestampOf != -1:
                            try:
                                parsedDate = datetime.fromtimestamp(int(timestampOf)/1000)
                            except Exception as e:
                                print(e)

                        toRet.events.append(Event(name=eventName, timestamp=parsedDate))
                except json.JSONDecodeError:
                    continue

    logs = await heimanConnector.getDeviceProperties(current_user, device_info["internal_device_id"])
    if logs.get("message", None) == "success":
        result = logs.get("result", {})
        data = result.get("data", [])
        for entry in data:
            typeOf = entry.get("type", {})
            valueOf = typeOf.get("value", "")
            if valueOf == "reportProperty":
                contentOf = entry.get("content", "")
                try:
                    parsed = json.loads(contentOf)
                    properties = parsed.get("properties", {})
                    timestampOf = parsed.get("timestamp", -1)
                    parsedDate = None
                    if timestampOf != -1:
                        try:
                            parsedDate = datetime.fromtimestamp(int(timestampOf)/1000)
                        except Exception as e:
                            print(e)
                    toRet.properties.append(PropertyReport(properties=properties, timestamp=parsedDate))
                except json.JSONDecodeError:
                    continue

        return toRet
    else:
        raise HTTPException(status_code=500, detail="Failed to fetch device logs")


@app.get("/list")
async def list_devices(current_user: str = Depends(get_authenticated_user)) -> List[ListReturnItem]:
    listing = await supadevices.list_devices_for_user(current_user)
    toRet = []
    for item in listing:
        parsedTime = datetime.fromisoformat(item["created_at"].replace("Z", "+00:00"))
        toRet.append(ListReturnItem(
            created_at=parsedTime,
            internal_uuid=item["uuid"],
            product_id=item["internal_product_id"],
            name=item.get("name", None)
        ))
    return toRet
# @app.get("/protected")
# async def protected_route(current_user: str = Depends(get_authenticated_user)):
#     productID = "1905532161226346496"
#     macadress = "4055481e5d6b"
#
#     what = await heimanConnector.queryDevice(current_user, "1905532161226346496", "4055481e5d6b")
#     print(what)
#
#     what2 = await heimanConnector.nameByDevice(current_user, "1905532161226346496", "4055481e5d6b")
#     result = what2["result"][0]
#     deviceID = result["id"]
#     print(deviceID)
#
#     what3 = await heimanConnector.deviceList(current_user)
#     print(what3)
#
#     what4 = await heimanConnector.getDeviceIDDetail(current_user, deviceID)
#     print(what4)
#
#     print("BINDING")
#     what5 = await heimanConnector.bind(current_user, deviceID)
#     print(what5)
#
#     listing = await heimanConnector.deviceList(current_user)
#     print(listing)
#
#     print("UNBINDING")
#     what6 = await heimanConnector.unbind(current_user, deviceID)
#     print(what6)
#     listing2 = await heimanConnector.deviceList(current_user)
#     print(listing2)
#
#
#
#
#     return {
#         "message": "Access granted to protected resource",
#         "user": current_user
#     }



@app.get("/health")
async def health_check():
    try:
        jwks = jwks_client.get_jwks()
        return {
            "status": "healthy",
            "jwks_keys_count": len(jwks.get("keys", [])),
            "available_key_ids": [key.get("kid") for key in jwks.get("keys", [])],
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


class EventPayload(BaseModel):
    tenant: str
    user: str
    eventName: str
    deviceId: str
    data: JsonValue
    messageId: str


async def processEFlara(tokens: List[str], device_uuid: str):
    await sleep(4) # wait for other notifications to turn off
    eFlaraStatus = await supadevices.get_eflara_for_device(device_uuid)
    if eFlaraStatus is not None and eFlaraStatus["enabled"]:
        print("Processing eFLARA", device_uuid)
        wasReqiested = await processEFlaraREQ(Address(address=eFlaraStatus["address"]))
        print("eFLARA REQ", wasReqiested)
        print("eFLARA REQ", wasReqiested)
        print("eFLARA REQ", wasReqiested)
        notiRequest = NotificationRequest(
            tokens=tokens,
            title="Zawiadomiono pierwszych ratowników (TEST)",
            body=f"Zawiadomiono pierwszych ratowników. Adres: {eFlaraStatus['address']}"
        )
        await processNotification(notiRequest, sound="ratownik.wav", channel="ratownik")

    pass

@app.post("/internal/event", include_in_schema=False)
async def internal_event(req: Request, event: EventPayload, background_tasks: BackgroundTasks):
    headerOf = req.headers.get("X-Internal-Secret", None)
    if headerOf != os.getenv("INTERNAL_SECRET"):
        raise HTTPException(status_code=403, detail="Forbidden")


    print("PROCESSING EVENT", event)

    userReplacedPrefix = event.user.replace("SH_", "", 1)

    device = await supadevices.get_device_by_user_device_id(userReplacedPrefix, event.deviceId)

    notifications = await supadevices.get_notification_tokens_for_user(userReplacedPrefix)
    if not notifications:
        print("NO TOKENS")
        return {"status": "no tokens"}

    if len(notifications) == 0:
        print("NO TOKENS")
        return {"status": "no tokens"}

    allTokens = []
    for item in notifications:
        token = item.get("token", None)
        if token is not None:
            allTokens.append(token)

    if event.eventName == "AlarmTest":
        title = "Wykryto dym! (TEST)"
        body = f"Wykryto dym. Urządzenie - {device['name']}"
        reqNoti = NotificationRequest(
            tokens=allTokens,
            title=title,
            body=body
        )
        background_tasks.add_task(processNotification, reqNoti)
        background_tasks.add_task(processEFlara, allTokens, device["uuid"])

    return {"status": "event received"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)