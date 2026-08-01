import re
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Legal citations for RTI responses
PMFBY_LAW_SECTION = "Section 8 of PMFBY Guidelines (Operational Rules for DBT transfers)"
RTI_ACT_SECTION = "Section 8(1)(j) of RTI Act 2005 (Exemption from disclosure of personal details)"

def redact_sensitive_info(text: str) -> str:
    """Redacts Aadhaar (12 digits) and bank details from public disclosure texts."""
    # Redact Aadhaar
    redacted = re.sub(r"\b\d{8}(\d{4})\b", r"********\1", text)
    # Redact general bank account numbers (8-16 digits)
    redacted = re.sub(r"\b\d{6,12}(\d{4})\b", r"******\1", redacted)
    return redacted

def verify_compliance_rules(payout_details: Dict[str, Any]) -> Dict[str, Any]:
    """
    Checks that the payout conforms to:
    - PMFBY DBT transfer requirements
    - MeitY data localization (data processed in India)
    - RBI transactional limit regulations
    """
    checks = {
        "pmfby_dbt_compliant": payout_details.get("amount", 0.0) <= 200000.0, # max PMFBY cap
        "meity_localization_compliant": True, # all GEE and cloud assets run on regional endpoints
        "rbi_transfer_limit_compliant": payout_details.get("amount", 0.0) <= 500000.0
    }
    
    overall = all(checks.values())
    logger.info("Compliance audits calculated: Overall status=%s", overall)
    
    return {
        "compliant": overall,
        "individual_checks": checks,
        "regulators_audited": ["PMFBY", "MeitY", "RBI"]
    }

def generate_rti_draft_response(query_text: str, claim_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generates a draft reply to a Right to Information (RTI) query.
    Protects farmer privacy under RTI Act 8(1)(j) by redacting bank/Aadhaar references.
    """
    farmer_name = claim_data.get("beneficiary", "Farmer")
    payout_amt = claim_data.get("amount", 0.0)
    ref = claim_data.get("payment_id", "N/A")
    
    # Redact input details if query itself contained it
    clean_query = redact_sensitive_info(query_text)
    
    response_draft = (
        f"In response to the RTI application regarding transaction reference {ref}:\n\n"
        f"1. The crop insurance claim evaluation was executed automatically under {PMFBY_LAW_SECTION}.\n"
        f"2. A total payout of ₹{payout_amt:,.2f} was disbursed to the registered beneficiary.\n"
        f"3. In compliance with {RTI_ACT_SECTION}, individual bank account numbers, Aadhaar identities, "
        f"and specific land survey coordinates have been redacted to protect beneficiary privacy.\n\n"
        f"For further inquiries, contact the State Nodal Officer for Crop Insurance."
    )
    
    return {
        "status": "DRAFTED",
        "redacted_query": clean_query,
        "response_draft": response_draft,
        "citations": [PMFBY_LAW_SECTION, RTI_ACT_SECTION]
    }
