import pytest
from app.payments.upi import generate_upi_link
from app.payments.neft import validate_ifsc, process_neft_transfer
from app.payments.pmkisan import verify_pm_kisan_dbt
from app.payments.state_machine import initialize_payment, execute_payment_with_retry, PAYMENT_LEDGER, encrypt_bank_details, decrypt_bank_details

def test_upi_link_generation():
    link = generate_upi_link("test@upi", "Ramesh Patel", 1200.50, "TXN999")
    assert "upi://pay?" in link
    assert "pa=test%40upi" in link or "pa=test@upi" in link
    assert "am=1200.50" in link
    assert "tr=TXN999" in link

def test_neft_validation_and_processing():
    assert validate_ifsc("SBIN0001234")
    assert not validate_ifsc("SBIN01234") # too short
    
    res = process_neft_transfer("1234567890", "SBIN0001234", "Ramesh Patel", 50000.0)
    assert res["status"] == "SUCCESS"
    assert "NEFT-" in res["transaction_reference"]

def test_pm_kisan_verification():
    # Valid active beneficiary Aadhaar
    res = verify_pm_kisan_dbt("123456789012")
    assert res["verified"]
    assert res["pm_kisan_id"] == "PMK-983421"
    
    # Non-existent Aadhaar
    res_fake = verify_pm_kisan_dbt("999999999999")
    assert not res_fake["verified"]
    assert res_fake["error"] == "BENEFICIARY_NOT_FOUND"

def test_payment_encryption_and_state_machine():
    # Test details encryption
    enc = encrypt_bank_details("1234567890", "SBIN0001234")
    dec = decrypt_bank_details(enc)
    assert dec == "1234567890:SBIN0001234"
    
    # State machine flow
    claim_id = 7777
    init = initialize_payment(
        claim_id=claim_id,
        amount=25000.0,
        farmer_name="Ramesh Patel",
        account_number="1234567890",
        ifsc="SBIN0001234",
        upi_id="ramesh@upi",
        payment_mode="NEFT"
    )
    assert init["status"] == "INITIATED"
    assert init["claim_id"] == claim_id
    
    # Process
    p_res = execute_payment_with_retry(claim_id)
    assert p_res["status"] == "COMPLETED"
    assert p_res["retry_attempts"] >= 1
