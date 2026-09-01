SENT_SMS_MESSAGES = []
import os
import random
import requests
import redis
import logging
from typing import Dict
from redis.exceptions import ConnectionError, TimeoutError

logger = logging.getLogger(__name__)

# Mock Redis fallback for development environments without running Redis instance
class MockRedis:
    def __init__(self):
        self.store = {}
        self.expiries = {}
        logger.info("Initializing MockRedis fallback storage.")

    def get(self, key):
        return self.store.get(key)

    def setex(self, key, time, value):
        self.store[key] = str(value)
        return True

    def exists(self, key):
        return key in self.store

    def delete(self, key):
        if key in self.store:
            del self.store[key]
            return 1
        return 0

    def incr(self, key):
        val = int(self.store.get(key, 0)) + 1
        self.store[key] = str(val)
        return val

    class MockPipeline:
        def __init__(self, parent):
            self.parent = parent
            self.ops = []

        def incr(self, key):
            self.ops.append(("incr", key))
            return self

        def expire(self, key, time):
            self.ops.append(("expire", key, time))
            return self

        def execute(self):
            results = []
            for op, *args in self.ops:
                if op == "incr":
                    results.append(self.parent.incr(args[0]))
                elif op == "expire":
                    results.append(True)
            self.ops = []
            return results

    def pipeline(self):
        return self.MockPipeline(self)

REDIS_URL = os.getenv("REDIS_URL", "redis://:agrisense123@localhost:6379/0")

try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True)
    redis_client.ping()
    logger.info("Successfully connected to Redis database.")
except (ConnectionError, TimeoutError, Exception) as e:
    logger.warning(f"Could not connect to Redis at {REDIS_URL}: {e}. Falling back to in-memory MockRedis.")
    redis_client = MockRedis()

class SMSService:
    """Generic SMS interface. Currently wired to MSG91."""
    
    PROVIDER = os.getenv("SMS_PROVIDER", "msg91").lower()
    OTP_EXPIRY = 300  # 5 minutes
    MAX_ATTEMPTS = 3
    RATE_LIMIT_WINDOW = 3600  # 1 hour
    
    @staticmethod
    def generate_otp() -> str:
        """Cryptographically secure 6-digit OTP"""
        return str(random.SystemRandom().randint(100000, 999999))
    
    @classmethod
    def send_otp(cls, phone: str) -> Dict:
        """
        Send OTP to Indian phone number.
        Returns: {"success": bool, "message": str, "expires_in": int}
        """
        # Clean phone
        phone = phone.replace("+91", "").replace(" ", "").replace("-", "").strip()
        
        # Validate
        if not phone.isdigit() or len(phone) != 10:
            return {"success": False, "error": "Enter valid 10-digit mobile number"}
        
        if not phone.startswith(("6", "7", "8", "9")):
            return {"success": False, "error": "Invalid Indian mobile number"}
        
        # Rate limit check
        rate_key = f"otp_rate:{phone}"
        if redis_client.exists(rate_key) and int(redis_client.get(rate_key) or 0) >= 5:
            return {"success": False, "error": "Too many requests. Try again after 1 hour."}
        
        # Generate OTP
        otp = cls.generate_otp()
        
        # Store in Redis
        redis_client.setex(f"otp:{phone}", cls.OTP_EXPIRY, otp)
        redis_client.setex(f"otp_attempts:{phone}", cls.OTP_EXPIRY, "0")
        
        # Log simulated SMS message
        import time
        msg = f"Message from AGRISE: Your AgriSense OTP is {otp}. Valid for 5 mins."
        SENT_SMS_MESSAGES.append({
            "phone": phone,
            "message": msg,
            "timestamp": time.time()
        })
        
        # Increment rate limit
        pipe = redis_client.pipeline()
        pipe.incr(rate_key)
        pipe.expire(rate_key, cls.RATE_LIMIT_WINDOW)
        pipe.execute()
        
        # Send via configured provider
        if cls.PROVIDER == "msg91":
            return cls._send_msg91(phone, otp)
        elif cls.PROVIDER == "console":
            # Development fallback: prints to console
            print(f"\n{'='*50}")
            print(f"DEV OTP for {phone}: {otp}")
            print(f"{'='*50}\n")
            logger.info(f"Generated OTP for {phone}: {otp}")
            return {"success": True, "message": "OTP sent (check console)", "expires_in": cls.OTP_EXPIRY}
        else:
            return {"success": False, "error": "SMS provider not configured"}
    
    @classmethod
    def verify_otp(cls, phone: str, otp: str) -> Dict:
        """Verify OTP. Returns user-friendly status."""
        phone = phone.replace("+91", "").replace(" ", "").replace("-", "").strip()
        
        stored = redis_client.get(f"otp:{phone}")
        if not stored:
            return {"success": False, "error": "OTP expired. Please request a new one."}
        
        # Check attempts
        attempts_key = f"otp_attempts:{phone}"
        attempts = int(redis_client.get(attempts_key) or 0)
        if attempts >= cls.MAX_ATTEMPTS:
            redis_client.delete(f"otp:{phone}")
            return {"success": False, "error": "Too many failed attempts. Request new OTP."}
        
        if stored != otp.strip():
            redis_client.incr(attempts_key)
            remaining = cls.MAX_ATTEMPTS - attempts - 1
            if remaining <= 0:
                redis_client.delete(f"otp:{phone}")
                return {"success": False, "error": "Too many failed attempts. Request new OTP."}
            return {
                "success": False, 
                "error": f"Invalid OTP. {remaining} attempt(s) remaining."
            }
        
        # Success - clean up
        redis_client.delete(f"otp:{phone}")
        redis_client.delete(attempts_key)
        return {"success": True}
    
    @classmethod
    def _send_msg91(cls, phone: str, otp: str) -> Dict:
        """MSG91 integration"""
        authkey = os.getenv("MSG91_AUTH_KEY")
        template_id = os.getenv("MSG91_TEMPLATE_ID")
        sender_id = os.getenv("MSG91_SENDER_ID", "AGRSNS")
        
        if not authkey:
            return {"success": False, "error": "MSG91 not configured. Set MSG91_AUTH_KEY in .env"}
        
        url = "https://control.msg91.com/api/v5/otp"
        payload = {
            "template_id": template_id,
            "sender": sender_id,
            "otp": otp,
            "mobile": f"91{phone}"
        }
        headers = {
            "authkey": authkey,
            "Content-Type": "application/json"
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers, timeout=10)
            if response.status_code == 200:
                return {
                    "success": True,
                    "message": "OTP sent successfully",
                    "expires_in": cls.OTP_EXPIRY
                }
            else:
                return {
                    "success": False, 
                    "error": f"SMS gateway error: {response.text}"
                }
        except Exception as e:
            return {"success": False, "error": f"Network error: {str(e)}"}
