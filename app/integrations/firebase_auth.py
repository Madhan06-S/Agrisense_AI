import os
import json
import logging
from typing import Dict, Optional
import firebase_admin
from firebase_admin import credentials, auth

logger = logging.getLogger(__name__)

# Fetch service account path
cred_path = os.getenv("FIREBASE_CREDENTIALS", "./firebase-admin.json")

if not os.path.exists(cred_path):
    raise RuntimeError(f"Firebase credentials file not found at {cred_path}. Please place your service account key there.")

# Check if using the dummy key for mock local verification
is_mock_env = False
try:
    with open(cred_path, "r") as f:
        key_data = json.load(f)
        if "mock_private_key_id_12345" in key_data.get("private_key_id", ""):
            is_mock_env = True
            logger.warning("Running in FIREBASE MOCK MODE due to dummy credentials file.")
except Exception as e:
    logger.warning(f"Error parsing Firebase credentials for mock detection: {e}")

try:
    cred = credentials.Certificate(cred_path)
    firebase_admin.initialize_app(cred)
    logger.info("Firebase Admin SDK initialized successfully.")
except Exception as e:
    raise RuntimeError(f"Failed to initialize Firebase Admin SDK: {e}")

class FirebaseAuthService:
    @staticmethod
    def verify_id_token(id_token: str) -> dict:
        """
        Verifies the Firebase ID token and returns decoded token data.
        Returns: dict with uid, phone (with +91 removed), name, email if present.
        """
        if is_mock_env and id_token.startswith("mock-token-"):
            phone_num = id_token.replace("mock-token-", "")
            logger.info(f"Verified mock token for phone {phone_num}")
            return {
                "uid": f"mock-uid-{phone_num}",
                "phone": phone_num,
                "name": "Mock User",
                "email": f"{phone_num}@agrisense.gov.in"
            }

        try:
            decoded_token = auth.verify_id_token(id_token, clock_skew_seconds=30)
            uid = decoded_token.get("uid")
            phone = decoded_token.get("phone_number") or ""
            
            # Clean +91 prefix
            cleaned_phone = phone.replace("+91", "").replace(" ", "").replace("-", "").strip()
            
            return {
                "uid": uid,
                "phone": cleaned_phone,
                "name": decoded_token.get("name"),
                "email": decoded_token.get("email")
            }
        except Exception as e:
            logger.error(f"Error verifying Firebase ID token: {e}")
            raise ValueError(f"Invalid Firebase token: {str(e)}")

    @staticmethod
    def get_user_by_phone(phone: str) -> Optional[str]:
        """
        Queries Firebase Auth to check if user exists by phone.
        Adds +91 prefix internally.
        Returns: Firebase UID or None
        """
        if is_mock_env:
            return f"mock-uid-{phone}"

        # Ensure it starts with +91 prefix
        if not phone.startswith("+"):
            formatted_phone = f"+91{phone.replace('+91', '').replace(' ', '').replace('-', '').strip()}"
        else:
            formatted_phone = phone
            
        try:
            user = auth.get_user_by_phone(formatted_phone)
            return user.uid
        except auth.UserNotFoundError:
            return None
        except Exception as e:
            logger.error(f"Error checking user by phone in Firebase: {e}")
            return None
