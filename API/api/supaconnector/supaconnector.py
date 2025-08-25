import aiohttp
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)


class SupabaseDevicesClient:
    def __init__(self, supabase_url: str, service_role_key: str):
        self.supabase_url = supabase_url.rstrip('/')
        self.service_role_key = service_role_key
        self.base_url = f"{self.supabase_url}/rest/v1"

        # Default headers for all requests
        self.headers = {
            "apikey": self.service_role_key,
            "Authorization": f"Bearer {self.service_role_key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"  # Return inserted/updated data
        }

    async def _make_request(self, method: str, endpoint: str, **kwargs) -> Dict[str, Any]:
        """Make HTTP request to Supabase"""
        url = f"{self.base_url}/{endpoint}"

        async with aiohttp.ClientSession() as session:
            async with session.request(method, url, headers=self.headers, **kwargs) as response:
                response_text = await response.text()

                if response.status >= 400:
                    logger.error(f"Request failed: {method} {url} - {response.status}: {response_text}")
                    raise Exception(f"Supabase API error: {response.status} - {response_text}")

                if response_text:
                    return json.loads(response_text)
                return {}

    async def add_device_for_user(self, user_id: str, device_id: str, name: str, product_id: str) -> Dict[str, Any]:
        device_data = {
            "user_id": user_id,
            "internal_device_id": device_id,
            "internal_name": name,
            "internal_product_id": product_id,
            "created_at": datetime.utcnow().isoformat()
        }

        logger.info(f"Adding device {device_id} for user {user_id}")

        try:
            result = await self._make_request(
                "POST",
                "devices",
                json=[device_data]
            )

            if result:
                logger.info(f"Device {device_id} added successfully")
                return result[0] if isinstance(result, list) else result
            else:
                raise Exception("No data returned from insert operation")

        except Exception as e:
            logger.error(f"Failed to add device: {e}")
            raise

    async def remove_device_from_user(self, user_id: str, device_id: str) -> bool:
        logger.info(f"Removing device {device_id} from user {user_id}")

        try:
            # First check if device exists for this user
            existing_device = await self.check_device_exists(user_id, device_id)
            if not existing_device:
                logger.warning(f"Device {device_id} not found for user {user_id}")
                return False

            # Delete the device
            await self._make_request(
                "DELETE",
                f"devices?user_id=eq.{user_id}&internal_device_id=eq.{device_id}"
            )

            logger.info(f"Device {device_id} removed successfully")
            return True

        except Exception as e:
            logger.error(f"Failed to remove device: {e}")
            raise

    async def get_device_by_uuid(self, user_id, uuid: str) -> Optional[Dict[str, Any]]:
        try:
            result = await self._make_request(
                "GET",
                f"devices?user_id=eq.{user_id}&uuid=eq.{uuid}&select=internal_device_id,internal_product_id"
            )

            if result and len(result) > 0:
                return result[0]
            return None

        except Exception as e:
            logger.error(f"Failed to get device by UUID: {e}")
            raise

    async def check_device_exists_in_the_system(self, device_id: str) -> Optional[Dict[str, Any]]:
        try:
            result = await self._make_request(
                "GET",
                f"devices?internal_device_id=eq.{device_id}&select=*"
            )

            if result and len(result) > 0:
                logger.info(f"Device {device_id} found")
                return result[0]
            else:
                logger.info(f"Device {device_id} not")
                return None

        except Exception as e:
            logger.error(f"Failed to check device existence: {e}")
            raise

    async def check_device_exists(self, user_id: str, device_id: str) -> Optional[Dict[str, Any]]:
        try:
            result = await self._make_request(
                "GET",
                f"devices?user_id=eq.{user_id}&internal_device_id=eq.{device_id}&select=*"
            )

            if result and len(result) > 0:
                logger.info(f"Device {device_id} found for user {user_id}")
                return result[0]
            else:
                logger.info(f"Device {device_id} not found for user {user_id}")
                return None

        except Exception as e:
            logger.error(f"Failed to check device existence: {e}")
            raise

    async def list_devices_for_user(self, user_id: str, limit: Optional[int] = None, offset: Optional[int] = None) -> \
    List[Dict[str, Any]]:
        logger.info(f"Fetching devices for user {user_id}")

        try:
            # Build query string
            query_params = [f"user_id=eq.{user_id}", "select=created_at,uuid,internal_product_id,internal_device_id,name"]

            # Add ordering
            query_params.append("order=created_at.desc")

            # Add pagination if specified
            if limit is not None:
                if offset is not None:
                    query_params.append(f"offset={offset}")
                query_params.append(f"limit={limit}")

            query_string = "&".join(query_params)

            result = await self._make_request(
                "GET",
                f"devices?{query_string}"
            )

            logger.info(f"Found {len(result)} devices for user {user_id}")
            return result if result else []

        except Exception as e:
            logger.error(f"Failed to list devices: {e}")
            raise

    async def update_device(self, user_id: str, device_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        logger.info(f"Updating device {device_id} for user {user_id}")

        try:
            # First check if device exists
            existing_device = await self.check_device_exists(user_id, device_id)
            if not existing_device:
                logger.warning(f"Device {device_id} not found for user {user_id}")
                return None

            # Update the device
            result = await self._make_request(
                "PATCH",
                f"devices?user_id=eq.{user_id}&internal_device_id=eq.{device_id}",
                json=updates
            )

            if result:
                logger.info(f"Device {device_id} updated successfully")
                return result[0] if isinstance(result, list) else result
            else:
                return None

        except Exception as e:
            logger.error(f"Failed to update device: {e}")
            raise

    async def get_device_by_id(self, device_id: str) -> Optional[Dict[str, Any]]:
        try:
            result = await self._make_request(
                "GET",
                f"devices?internal_device_id=eq.{device_id}&select=*"
            )

            if result and len(result) > 0:
                return result[0]
            return None

        except Exception as e:
            logger.error(f"Failed to get device by ID: {e}")
            raise
