from os.path import split

import paho.mqtt.client as mqtt
import json
import ssl
import hashlib
import hmac
import time
import uuid
from datetime import datetime
from typing import Dict, Any, Optional
import json
import requests
import os
URL_TO_SEND = os.environ.get("URL_TO_SEND", "http://localhost:3000/internal/event")
INTERNAL_SECRET = os.environ.get("INTERNAL_SECRET", "SECRET")


def sendEvent(tenant, user, event, deviceid, data, messageid):
    try:
        headers = {
            "Content-Type": "application/json",
            "X-Internal-Secret": INTERNAL_SECRET
        }
        payload = {
            "tenant": tenant,
            "user": user,
            "eventName": event,
            "deviceId": deviceid,
            "data": data,
            "messageId": messageid
        }
        response = requests.post(URL_TO_SEND, headers=headers, json=payload)
        if response.status_code == 200:
            print(f"Event sent successfully to {URL_TO_SEND}")
        else:
            print(f"Failed to send event. Status code: {response.status_code}, Response: {response.text}")
    except Exception as e:
        print(f"Error sending event: {e}")

class HeimanMqttClient:
    def __init__(self, app_id: str, secure_key: str, broker_host: str = "spmqtt.heiman.cn", broker_port: int = 1884):
        self.app_id = app_id
        self.secure_key = secure_key
        self.broker_host = broker_host
        self.broker_port = broker_port

        self.client_id = f"heiman_client_{uuid.uuid4().hex[:8]}"

        self.client = mqtt.Client(client_id=self.client_id, protocol=mqtt.MQTTv311)

        self.client.on_connect = self._on_connect
        self.client.on_disconnect = self._on_disconnect
        self.client.on_message = self._on_message
        self.client.on_publish = self._on_publish

        # Connection state
        self.is_connected = False

    def _generate_credentials(self) -> tuple[str, str]:
        timestamp = str(int(time.time() * 1000))

        username = f"app_{self.app_id}|{timestamp}"

        password_string = f"{self.app_id}|{timestamp}|{self.secure_key}"
        password = hashlib.md5(password_string.encode('utf-8')).hexdigest()

        return username, password

    def connect(self) -> bool:
        """Connect to MQTT broker"""
        try:
            username, password = self._generate_credentials()

            self.client.username_pw_set(username, password)

            context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            self.client.tls_set_context(context)

            print(f"Connecting to {self.broker_host}:{self.broker_port}")
            print(f"Client ID: {self.client_id}")
            print(f"Username: {username}")

            self.client.connect(self.broker_host, self.broker_port, 60)

            self.client.loop_start()

            # Wait for connection
            timeout = 10
            while not self.is_connected and timeout > 0:
                time.sleep(0.5)
                timeout -= 0.5

            return self.is_connected

        except Exception as e:
            print(f"Connection failed: {e}")
            return False

    def disconnect(self):
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()

    def _on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            print("✓ Connected to MQTT broker successfully!")
            self.is_connected = True

            # Subscribe to all tenants and users with wildcard
            topics = [
                "$queue//iot/user/#",  # Listen to all SH_ prefixed topics
                "iot/user/+/+/#",  # Alternative pattern for all users
            ]

            for topic in topics:
                result = client.subscribe(topic, qos=2)
                print(f"Subscribed to: {topic} (Result: {result})")

        else:
            print(f"✗ Failed to connect to MQTT broker. Return code: {rc}")
            error_messages = {
                1: "Connection refused - incorrect protocol version",
                2: "Connection refused - invalid client identifier",
                3: "Connection refused - server unavailable",
                4: "Connection refused - bad username or password",
                5: "Connection refused - not authorised"
            }
            print(f"Error: {error_messages.get(rc, 'Unknown error')}")

    def _on_disconnect(self, client, userdata, rc):
        """Callback for when client disconnects from broker"""
        self.is_connected = False
        if rc != 0:
            print(f"✗ Unexpected disconnection. Return code: {rc}")
        else:
            print("✓ Disconnected from MQTT broker")

    def _on_message(self, client, userdata, msg):
        """Callback for when a message is received"""
        try:
            topic = msg.topic
            payload = msg.payload.decode('utf-8')
            splitted = topic.split('/')
            if len(splitted) <= 3 or not splitted[3].startswith("SH_"):
                print("Omitting", topic)
                return

            tenant = splitted[3]
            user = splitted[4]
            print(f"Message for Tenant: {tenant}, User: {user}")
            try:
                loaded = json.loads(payload)
                messageType = loaded.get("messageType", "UNKNOWN")
                if messageType == "EVENT":
                    eventName = loaded.get("event", "UNKNOWN")
                    deviceID = loaded.get("deviceId", "UNKNOWN")
                    messageId = loaded.get("messageId", "UNKNOWN")
                    data = loaded.get("data", {})
                    print(tenant, user, eventName, deviceID, data)
                    sendEvent(tenant, user, eventName, deviceID, data, messageId)
                print(payload)

            except json.JSONDecodeError:
                print("Its not json!!", payload)
                return


        except Exception as e:
            print(f"Error processing message: {e}")

    def _on_publish(self, client, userdata, mid):
        """Callback for when a message is published"""
        print(f"✓ Message published successfully (MID: {mid})")

    def publish_message(self, topic: str, payload: Dict[str, Any], qos: int = 1) -> bool:
        """Publish a message to a topic"""
        try:
            json_payload = json.dumps(payload)
            result = self.client.publish(topic, json_payload, qos=qos)

            if result.rc == mqtt.MQTT_ERR_SUCCESS:
                print(f"📤 Publishing to: {topic}")
                return True
            else:
                print(f"✗ Failed to publish message. Error code: {result.rc}")
                return False

        except Exception as e:
            print(f"Error publishing message: {e}")
            return False

    def send_property_write(self, product_id: str, device_id: str, properties: Dict[str, Any]):
        """Send property write command to device"""
        topic = f"iot/device/{product_id}/{device_id}/properties/write"
        payload = {
            "properties": properties,
            "timestamp": int(time.time() * 1000)
        }
        return self.publish_message(topic, payload)

    def send_property_read(self, product_id: str, device_id: str, properties: list):
        """Send property read request to device"""
        topic = f"iot/device/{product_id}/{device_id}/properties/read"
        payload = {
            "properties": properties,
            "timestamp": int(time.time() * 1000)
        }
        return self.publish_message(topic, payload)


def main():
    APP_ID = os.environ.get("APP_ID", None)
    SECURE_KEY = os.environ.get("SECURE_KEY", None)
    print(f"App ID: {APP_ID}")
    print(f"Secure Key: {SECURE_KEY[:8]}...")

    client = HeimanMqttClient(APP_ID, SECURE_KEY)

    if client.connect():
        print("\n🎉 Successfully connected! Listening for messages...")
        print("Press Ctrl+C to stop")

        try:
            # Keep the client running
            while True:
                time.sleep(1)

        except KeyboardInterrupt:
            print("\n\n🛑 Stopping client...")
            client.disconnect()
            print("✅ Client stopped successfully")

    else:
        print("❌ Failed to connect to MQTT broker")


if __name__ == "__main__":
    main()