import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Registered devices FCM tokens database
DEVICE_FCM_REGISTRY: Dict[int, str] = {}

def register_fcm_token(farm_id: int, token: str) -> None:
    """Registers a mobile device token for push alerts."""
    DEVICE_FCM_REGISTRY[farm_id] = token
    logger.info("Registered FCM token for Farm %d: %s", farm_id, token[:10] + "...")

def dispatch_sms_alert(phone: str, text: str) -> bool:
    """Simulates SMS dispatch via mobile telecom trunk."""
    logger.info("SMS Alert Dispatched to %s: %s", phone, text[:40] + "...")
    return True

def dispatch_whatsapp_message(phone: str, text: str) -> bool:
    """Simulates WhatsApp Business API dispatch."""
    logger.info("WhatsApp Alert Dispatched to %s: %s", phone, text[:40] + "...")
    return True

def dispatch_push_notification(farm_id: int, title: str, body: str) -> bool:
    """Simulates Firebase Cloud Messaging push dispatch."""
    token = DEVICE_FCM_REGISTRY.get(farm_id)
    if token:
        logger.info("Push notification sent to FCM token %s. Title: %s", token[:10], title)
        return True
    logger.warning("FCM token not found for Farm %d. Push skipped.", farm_id)
    return False

def dispatch_ivr_voice_call(phone: str, audio_text: str) -> bool:
    """Simulates Twilio/Interactive Voice Response outbound call for illiterate farmers."""
    logger.info("IVR Outbound Voice Call initiated to %s: Speaking '%s'", phone, audio_text[:40] + "...")
    return True
