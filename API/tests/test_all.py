import requests
import json


def test_login_with_email_password():
    supabase_url = "https://zjqohfcskeirutsezxua.supabase.co"
    """Login using email and password"""
    auth_url = f"{supabase_url}/auth/v1/token?grant_type=password"

    headers = {
        "Content-Type": "application/json",
        "apikey": "sb_publishable_dfMaPN93kuterw73mpxcNQ_IajY32YM"
    }

    data = {
        "email": "adam.razniewski@gmail.com",
        "password": "adam4541"
    }

    response = requests.post(auth_url, headers=headers, json=data)
    assert response.status_code == 200
    auth_data = response.json()

    print("Login successful", auth_data["access_token"])
    assert False == True