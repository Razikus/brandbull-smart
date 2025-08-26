import os
from ast import parse

from fastapi import FastAPI, HTTPException, Depends, Security
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
import jwt  # PyJWT library
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import logging
from .supajwks.jwksclient import JWKSClient
import logging
from .heiman.heimanconnector import HeimanConnector
from pydantic import BaseModel
from .supaconnector.supaconnector import SupabaseDevicesClient
from typing import List




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
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

security = HTTPBearer()

heimanConnector = HeimanConnector("https://spapi.heiman.cn", "SB7sFDXHe3WQyF7k", "K2rDXbNbF3hfc3Z7RDXPmYHGm54b6fCD")

JWKS_URL = "https://zjqohfcskeirutsezxua.supabase.co/auth/v1/.well-known/jwks.json"
CACHE_DURATION = 3600*4
jwks_client = JWKSClient(JWKS_URL, CACHE_DURATION)
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET")
SRK = "sb_secret_ZyWQ03m3c_CxN38MyxAviQ_b4OZy4B5"

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


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)