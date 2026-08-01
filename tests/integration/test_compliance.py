import pytest
from app.compliance.audit import COMPLIANCE_AUDIT_LOG
from app.compliance.reports import redact_sensitive_info, verify_compliance_rules, generate_rti_draft_response

def test_audit_hash_chain():
    # Chain must be valid initially (contains genesis block)
    assert COMPLIANCE_AUDIT_LOG.validate_chain()
    
    # Append block
    b1 = COMPLIANCE_AUDIT_LOG.append_log("CLAIM_EVALUATED", {"claim_id": 100, "status": "APPROVED"})
    assert b1.index == 1
    assert b1.preceding_hash == COMPLIANCE_AUDIT_LOG.chain[0].hash
    
    # Append another block
    b2 = COMPLIANCE_AUDIT_LOG.append_log("PAYMENT_DISBURSED", {"payment_id": "PAY-123", "amount": 45000.0})
    assert b2.index == 2
    assert b2.preceding_hash == b1.hash
    
    # Chain must validate fully
    assert COMPLIANCE_AUDIT_LOG.validate_chain()
    
    # Tempering simulation: alter b1 action
    b1.action = "TAMPERED_ACTION"
    assert not COMPLIANCE_AUDIT_LOG.validate_chain()
    
    # Restore action
    b1.action = "CLAIM_EVALUATED"
    b1.hash = b1.calculate_hash() # restore hash
    
def test_redaction_and_compliance():
    # Sensitive details redaction check
    sample_text = "Farmer Ramesh Patel Aadhaar: 123456789012 bank account: 1234567890"
    cleaned = redact_sensitive_info(sample_text)
    
    assert "123456789012" not in cleaned
    assert "1234567890" not in cleaned
    assert "********9012" in cleaned
    
    # Regulatory compliance audits checks
    good_tx = {"amount": 45000.0}
    res_good = verify_compliance_rules(good_tx)
    assert res_good["compliant"]
    
    bad_tx = {"amount": 250000.0} # exceeds PMFBY cap 200000
    res_bad = verify_compliance_rules(bad_tx)
    assert not res_bad["compliant"]

def test_rti_drafting():
    claim = {
        "payment_id": "PAY-88992",
        "beneficiary": "Suresh Kumar",
        "amount": 75000.0
    }
    
    res = generate_rti_draft_response("Requesting details for Aadhaar 987654321098 and bank 1234567890", claim)
    assert res["status"] == "DRAFTED"
    assert "987654321098" not in res["redacted_query"]
    assert "PAY-88992" in res["response_draft"]
    assert "Suresh Kumar" not in res["response_draft"]
