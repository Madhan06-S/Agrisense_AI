import re
import uuid
import logging
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# Basic IFSC code validation regex
IFSC_REGEX = re.compile(r"^[A-Z]{4}0[A-Z0-9]{6}$")

def validate_ifsc(ifsc: str) -> bool:
    """
    Checks if the bank IFSC code follows standard RBI rules.
    Example valid: SBIN0001234
    """
    return bool(IFSC_REGEX.match(ifsc.upper()))

def process_neft_transfer(
    account_number: str,
    ifsc: str,
    beneficiary_name: str,
    amount: float
) -> Dict[str, Any]:
    """
    Simulates a NEFT bank ledger transfer request.
    """
    if not validate_ifsc(ifsc):
        logger.error("Failed IFSC validation for NEFT transfer: %s", ifsc)
        return {
            "status": "FAILED",
            "error": "INVALID_IFSC",
            "transaction_reference": None
        }
        
    txn_ref = f"NEFT-{uuid.uuid4().hex[:12].upper()}"
    logger.info("NEFT transfer initiated successfully. Ref: %s to %s", txn_ref, beneficiary_name)
    
    return {
        "status": "SUCCESS",
        "transaction_reference": txn_ref,
        "beneficiary": beneficiary_name,
        "amount": amount
    }

def process_bulk_neft(transactions: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Processes batch lists of farmer payouts.
    """
    success = []
    failed = []
    
    for tx in transactions:
        res = process_neft_transfer(
            account_number=tx["account_number"],
            ifsc=tx["ifsc"],
            beneficiary_name=tx["name"],
            amount=tx["amount"]
        )
        if res["status"] == "SUCCESS":
            success.append({**tx, "reference": res["transaction_reference"]})
        else:
            failed.append({**tx, "error": res["error"]})
            
    return {
        "processed_count": len(transactions),
        "success_count": len(success),
        "failed_count": len(failed),
        "success_records": success,
        "failed_records": failed
    }
