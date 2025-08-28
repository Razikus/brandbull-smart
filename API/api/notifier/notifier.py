from enum import verify
from typing import List
import aiohttp
from pydantic import BaseModel
import os

class NotificationRequest(BaseModel):
    title: str
    body: str
    tokens: List[str]

class Address(BaseModel):
    address: str

eFlaraAPIKEY = os.environ.get("EFLARA_APIKEY", "XXXX")

async def processEFlaraREQ(adr: Address):
    async with aiohttp.ClientSession() as session:
        async with session.post("https://api.1rtest.pl/api/flares/", json={
            "address": adr.address,
            "apiKey":eFlaraAPIKEY
        }, ssl=False) as response:
            jsoned = await response.json()
            return jsoned


async def processNotification(notification: NotificationRequest, sound = "dym.wav", channel = "alarm"):
    url = "https://exp.host/--/api/v2/push/send"
    print("PROCESSING REQUEST", notification)
    for expo_token in notification.tokens:
        message = {
            "to": expo_token,
            "title": notification.title,
            "body": notification.body,
            "sound": sound,
            "priority": "high",
            "channelId": channel,
        }

        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }
        try:

            async with aiohttp.ClientSession() as session:
                async with session.post(url, headers=headers, json=message) as response:
                    jsoned = await response.json()
                    print("NOTI REQ", jsoned, flush=True)
        except Exception as e:
            print(f"Error sending notification to {expo_token}: {e}")


