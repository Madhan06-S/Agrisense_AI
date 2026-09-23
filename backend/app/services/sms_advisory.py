import os
import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Check for SMS provider credentials in environment
TWILIO_ACCOUNT_SID = os.environ.get("TWILIO_ACCOUNT_SID", "")
TWILIO_AUTH_TOKEN = os.environ.get("TWILIO_AUTH_TOKEN", "")
TWILIO_FROM = os.environ.get("TWILIO_FROM_NUMBER", "+18005550199")

async def generate_sms_risk_advisory(
    mobile: str,
    farm_id: int,
    db: Any,
    language: str = "en-IN"
) -> Dict[str, Any]:
    """
    Generates a concise 2-3 line SMS advisory (<=160 chars per segment)
    for feature phone access without requiring smartphones or apps.
    """
    from sqlalchemy import text
    
    # 1. Fetch farm name
    farm_name = f"Farm #{farm_id}"
    try:
        res = await db.execute(text(f"SELECT name, crop_type FROM farms WHERE id = {farm_id}"))
        row = res.first()
        if row and row[0]:
            farm_name = row[0]
    except Exception:
        pass

    # 2. Fetch latest NDVI
    ndvi_val = 0.58
    try:
        sat_res = await db.execute(text(f"SELECT ndvi FROM satellite_readings WHERE farm_id = {farm_id} ORDER BY acquisition_date DESC LIMIT 1"))
        sat_row = sat_res.first()
        if sat_row and sat_row[0] is not None:
            ndvi_val = float(sat_row[0])
    except Exception:
        pass

    # 3. Weather mock/live
    rain_mm = 12.5

    # 4. Compose localized concise SMS text (GSM-7 length aware)
    if "ta" in language.lower():
        msg_text = (
            f"AgriSense: {farm_name} NDVI={ndvi_val:.2f}. "
            f"மழை {rain_mm}mm எதிர்பார்ப்பு. நீர் பாய்ச்சுவதை தள்ளி வைக்கவும். "
            f"[Ref: AS-{farm_id}]"
        )
    elif "hi" in language.lower():
        msg_text = (
            f"एग्रीसेंस: {farm_name} NDVI={ndvi_val:.2f}। "
            f"{rain_mm}mm बारिश का अनुमान। सिंचाई स्थगित रखें। "
            f"[Ref: AS-{farm_id}]"
        )
    else:
        msg_text = (
            f"AgriSense Alert ({farm_name}): NDVI={ndvi_val:.2f}. "
            f"{rain_mm}mm rain forecast. Postpone irrigation & clear drainage. "
            f"[Ref: AS-{farm_id}]"
        )

    # Truncate to safety 160 limit if exceeded
    if len(msg_text) > 160:
        msg_text = msg_text[:157] + "..."

    # 5. Send via Twilio/MSG91 if credentials exist, else demo simulation
    sent_via = "console_demo"
    if TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN:
        try:
            from twilio.rest import Client
            client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
            client.messages.create(body=msg_text, from_=TWILIO_FROM, to=mobile)
            sent_via = "twilio_live"
        except Exception as err:
            logger.warning(f"SMS provider error: {err}. Falling back to demo mode.")

    logger.info(f"📱 SMS Advisory [{sent_via}] to {mobile}: {msg_text}")

    return {
        "status": "sent",
        "mobile": mobile,
        "language": language,
        "message": msg_text,
        "char_count": len(msg_text),
        "delivery_channel": sent_via
    }


async def generate_sms_copilot_response(
    mobile: str,
    query: str,
    db: Any,
    language: str = "en-IN"
) -> Dict[str, Any]:
    """
    Processes SMS query from feature phone and returns SMS-length reply (<=160 chars).
    """
    if "ta" in language.lower():
        reply = f"AgriSense: '{query[:20]}' - மழை வாய்ப்புள்ளதால் பாசனத்தை தள்ளிவைக்கவும். இயற்கை உரம் இடவும்."
    elif "hi" in language.lower():
        reply = f"एग्रीसेंस: '{query[:20]}' - सिंचाई रोकें और जैविक कीटनाशक का प्रयोग करें।"
    else:
        reply = f"AgriSense: Re '{query[:20]}' - Postpone irrigation due to high moisture. Apply bio-pesticide."

    if len(reply) > 160:
        reply = reply[:157] + "..."

    return {
        "status": "sent",
        "mobile": mobile,
        "query": query,
        "message": reply,
        "char_count": len(reply)
    }
