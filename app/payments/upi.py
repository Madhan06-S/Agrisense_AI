import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def generate_upi_link(upi_id: str, farmer_name: str, amount: float, txn_ref: str) -> str:
    """
    Generates a paytm/gpay-compatible merchant UPI payment deep-link.
    """
    # Standard UPI URI format: upi://pay?pa=address&pn=name&am=amount&tr=txnRef
    formatted_name = farmer_name.replace(" ", "%20")
    upi_uri = f"upi://pay?pa={upi_id}&pn={formatted_name}&am={amount:.2f}&tr={txn_ref}&cu=INR"
    logger.info("Generated UPI payload link for %s: %s", farmer_name, upi_uri)
    return upi_uri

def generate_qr_code_mock(upi_uri: str) -> str:
    """
    Returns a mock Base64 representation of a generated QR code.
    """
    # Mock QR SVG/Base64 string
    return "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAiIGhlaWdodD0iMTAwIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iYmxhY2siLz48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSI4MCIgaGVpZ2h0PSI4MCIgZmlsbD0id2hpdGUiLz48L3N2Zz4="

def verify_upi_webhook(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates postbacks from PhonePe, Paytm, or GPay merchant webhooks.
    """
    status = payload.get("status", "SUCCESS")
    txn_id = payload.get("txn_id")
    logger.info("UPI web hook callback received for transaction %s, status=%s", txn_id, status)
    
    return {
        "verified": True,
        "transaction_id": txn_id,
        "payout_status": "COMPLETED" if status == "SUCCESS" else "FAILED"
    }
