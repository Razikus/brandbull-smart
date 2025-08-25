from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import ec
import base64
import requests
from typing import Dict, Any, Optional
from datetime import datetime, timedelta
import logging
from fastapi import FastAPI, HTTPException, Depends, Security

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class JWKSClient:
    def __init__(self, jwks_url: str, cache_duration: int = 3600):
        self.jwks_url = jwks_url
        self.cache_duration = cache_duration
        self._jwks_cache = None
        self._cache_timestamp = None

    def get_jwks(self) -> Dict[str, Any]:
        """Fetch JWKS with caching"""
        now = datetime.utcnow()

        if (self._jwks_cache is None or
                self._cache_timestamp is None or
                (now - self._cache_timestamp).total_seconds() > self.cache_duration):

            try:
                response = requests.get(self.jwks_url, timeout=10)
                response.raise_for_status()
                self._jwks_cache = response.json()
                self._cache_timestamp = now
                logger.info("JWKS cache refreshed")
            except requests.RequestException as e:
                logger.error(f"Failed to fetch JWKS: {e}")
                if self._jwks_cache is None:
                    raise HTTPException(status_code=503, detail="Unable to fetch JWKS")

        return self._jwks_cache

    def get_signing_key(self, kid: str) -> Any:
        jwks = self.get_jwks()

        available_kids = [key.get("kid") for key in jwks.get("keys", [])]
        logger.debug(f"Available key IDs: {available_kids}")
        logger.debug(f"Looking for key ID: {kid}")

        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                logger.debug(f"Found matching key: {key}")
                return self._jwk_to_pem(key)

        logger.warning(f"Key {kid} not found, forcing JWKS refresh...")
        self._jwks_cache = None  # Force cache refresh
        jwks = self.get_jwks()

        available_kids = [key.get("kid") for key in jwks.get("keys", [])]
        logger.debug(f"After refresh - Available key IDs: {available_kids}")

        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                logger.debug(f"Found matching key after refresh: {key}")
                return self._jwk_to_pem(key)



        raise HTTPException(status_code=401,
                            detail=f"Unable to find key with kid: {kid}. Available keys: {available_kids}")


    def _base64url_decode(self, data: str) -> bytes:
        padding = 4 - (len(data) % 4)
        if padding != 4:
            data += '=' * padding
        return base64.urlsafe_b64decode(data)

    def _jwk_to_pem(self, jwk: Dict[str, Any]) -> bytes:
        if jwk.get("kty") == "EC":
            return self._ec_jwk_to_pem(jwk)
        elif jwk.get("kty") == "RSA":
            return self._rsa_jwk_to_pem(jwk)
        else:
            raise HTTPException(status_code=400, detail=f"Unsupported key type: {jwk.get('kty')}")

    def _ec_jwk_to_pem(self, jwk: Dict[str, Any]) -> bytes:
        try:
            x = self._base64url_decode(jwk["x"])
            y = self._base64url_decode(jwk["y"])

            curve_name = jwk.get("crv", "P-256")
            if curve_name == "P-256":
                curve = ec.SECP256R1()
            elif curve_name == "P-384":
                curve = ec.SECP384R1()
            elif curve_name == "P-521":
                curve = ec.SECP521R1()
            else:
                raise ValueError(f"Unsupported curve: {curve_name}")

            public_key = ec.EllipticCurvePublicKey.from_encoded_point(curve, b'\x04' + x + y)

            pem = public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            )
            return pem

        except Exception as e:
            logger.error(f"Failed to convert EC JWK to PEM: {e}")
            raise HTTPException(status_code=400, detail="Invalid EC key format")

    def _rsa_jwk_to_pem(self, jwk: Dict[str, Any]) -> bytes:
        try:
            from cryptography.hazmat.primitives.asymmetric import rsa

            n = self._base64url_decode(jwk["n"])  # modulus
            e = self._base64url_decode(jwk["e"])  # exponent

            n_int = int.from_bytes(n, byteorder='big')
            e_int = int.from_bytes(e, byteorder='big')

            public_key = rsa.RSAPublicKey(n_int, e_int)

            pem = public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            )

            return pem

        except KeyError as e:
            logger.error(f"Missing required RSA parameter: {e}")
            raise HTTPException(status_code=400, detail=f"Invalid RSA JWK: missing {e}")
        except Exception as e:
            logger.error(f"Failed to convert RSA JWK to PEM: {e}")
            raise HTTPException(status_code=400, detail="Invalid RSA key format")
