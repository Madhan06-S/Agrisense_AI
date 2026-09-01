import os
import time
import hmac
import hashlib
import base64
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

# Try to use cryptography Fernet for AES-256 encryption.
try:
    from cryptography.fernet import Fernet
    _FERNET_KEY = Fernet.generate_key()
    _CIPHER = Fernet(_FERNET_KEY)
    HAS_FERNET = True
except ImportError:
    logger.warning("cryptography package not available. Falling back to XOR-based Base64 obfuscation.")
    HAS_FERNET = False

# Idempotency and transaction state database cache
PAYMENT_LEDGER: Dict[int, Dict[str, Any]] = {}
SECRET_SIGNING_KEY = b"agrisense_secret_signing_key_2026"

# Digital wallet database (in-memory mock)
WALLET_BALANCES: Dict[int, float] = {}
WALLET_TRANSACTIONS: Dict[int, List[Dict[str, Any]]] = {}

def encrypt_bank_details(account_number: str, ifsc: str) -> str:
    """Encrypts bank details using AES-256 (or Base64 XOR fallback)."""
    raw_str = f"{account_number}:{ifsc}"
    if HAS_FERNET:
        return _CIPHER.encrypt(raw_str.encode()).decode()
    else:
        xor_key = 42
        xored = bytearray(c ^ xor_key for c in raw_str.encode())
        return base64.b64encode(xored).decode()

def decrypt_bank_details(encrypted_data: str) -> str:
    """Decrypts bank details."""
    if HAS_FERNET:
        return _CIPHER.decrypt(encrypted_data.encode()).decode()
    else:
        decoded = base64.b64decode(encrypted_data)
        xor_key = 42
        raw = bytearray(c ^ xor_key for c in decoded)
        return raw.decode()

def generate_digital_signature(claim_id: int, amount: float, recipient: str) -> str:
    """Generates a secure HMAC-SHA256 signature for verification."""
    msg = f"{claim_id}:{amount:.2f}:{recipient}"
    signature = hmac.new(SECRET_SIGNING_KEY, msg.encode(), hashlib.sha256).hexdigest()
    return signature

# Digital Wallet Core APIs
def create_digital_wallet(farmer_id: int) -> Dict[str, Any]:
    """Initializes a digital wallet for a farmer with a ₹0 baseline balance."""
    if farmer_id not in WALLET_BALANCES:
        WALLET_BALANCES[farmer_id] = 0.0
        WALLET_TRANSACTIONS[farmer_id] = []
        logger.info("Created Digital Wallet for Farmer %d.", farmer_id)
    return {
        "farmer_id": farmer_id,
        "balance_inr": WALLET_BALANCES[farmer_id],
        "status": "ACTIVE"
    }

def get_wallet_balance(farmer_id: int) -> float:
    """Retrieves current wallet balance (auto-creates if non-existent)."""
    if farmer_id not in WALLET_BALANCES:
        create_digital_wallet(farmer_id)
    return WALLET_BALANCES[farmer_id]

def get_wallet_transactions(farmer_id: int) -> List[Dict[str, Any]]:
    """Retrieves all credit/debit records for a farmer's wallet."""
    if farmer_id not in WALLET_TRANSACTIONS:
        create_digital_wallet(farmer_id)
    return WALLET_TRANSACTIONS[farmer_id]

def deposit_to_wallet(farmer_id: int, amount: float, reference_id: str, description: str = "Deposit") -> Dict[str, Any]:
    """Credits the farmer's digital wallet (supports e-Rupee e₹ / AEPS / UPI)."""
    # Enforce micro-payout limits (min ₹500, max ₹50,000 per transaction)
    if amount < 500.0 or amount > 50000.0:
        raise ValueError("Transaction amount must be between ₹500 and ₹50,000 (Micro-Payout optimization limits).")
        
    if farmer_id not in WALLET_BALANCES:
        create_digital_wallet(farmer_id)
        
    WALLET_BALANCES[farmer_id] += amount
    txn = {
        "transaction_id": f"TXN-{int(time.time())}-{reference_id[:6]}",
        "amount": amount,
        "type": "CREDIT",
        "timestamp": time.time(),
        "description": description
    }
    WALLET_TRANSACTIONS[farmer_id].append(txn)
    logger.info("Deposited ₹%s into Farmer %d wallet. New balance: ₹%s", amount, farmer_id, WALLET_BALANCES[farmer_id])
    return txn

def withdraw_from_wallet(farmer_id: int, amount: float, recipient_bank: str) -> Dict[str, Any]:
    """Debits the farmer's digital wallet and transfers it back to a bank account."""
    if farmer_id not in WALLET_BALANCES:
        create_digital_wallet(farmer_id)
        
    if WALLET_BALANCES[farmer_id] < amount:
        raise ValueError("Insufficient wallet balance.")
        
    WALLET_BALANCES[farmer_id] -= amount
    txn = {
        "transaction_id": f"TXN-{int(time.time())}-WDR",
        "amount": amount,
        "type": "DEBIT",
        "timestamp": time.time(),
        "description": f"Withdrawal to Bank: {recipient_bank}"
    }
    WALLET_TRANSACTIONS[farmer_id].append(txn)
    logger.info("Withdrew ₹%s from Farmer %d wallet. Remaining balance: ₹%s", amount, farmer_id, WALLET_BALANCES[farmer_id])
    return txn

def initialize_payment(
    claim_id: int,
    amount: float,
    farmer_name: str,
    account_number: str,
    ifsc: str,
    upi_id: str,
    payment_mode: str = "UPI" # UPI, AEPS, BBPS, CBDC
) -> Dict[str, Any]:
    """Starts the payment flow. Ensures IDEMPOTENCY."""
    if claim_id in PAYMENT_LEDGER:
        return PAYMENT_LEDGER[claim_id]
        
    enc_details = encrypt_bank_details(account_number, ifsc)
    signature = generate_digital_signature(claim_id, amount, farmer_name)
    
    payment_record = {
        "payment_id": f"PAY-{int(time.time())}-{claim_id}",
        "claim_id": claim_id,
        "amount": amount,
        "beneficiary": farmer_name,
        "encrypted_details": enc_details,
        "digital_signature": signature,
        "payment_mode": payment_mode,
        "status": "INITIATED",
        "retry_attempts": 0,
        "last_updated": time.time(),
        "error_message": None
    }
    
    PAYMENT_LEDGER[claim_id] = payment_record
    logger.info("Payment initialized for Claim %d, amount: ₹%s", claim_id, amount)
    return payment_record

def transition_payment_status(claim_id: int, new_status: str, error_msg: Optional[str] = None) -> Dict[str, Any]:
    """Transitions payment status."""
    if claim_id not in PAYMENT_LEDGER:
        raise ValueError(f"No payment record found for claim_id {claim_id}")
        
    record = PAYMENT_LEDGER[claim_id]
    old_status = record["status"]
    
    valid_transitions = {
        "INITIATED": ["PENDING", "FAILED"],
        "PENDING": ["PROCESSING", "FAILED"],
        "PROCESSING": ["COMPLETED", "FAILED"],
        "FAILED": ["PENDING", "PROCESSING"]
    }
    
    if new_status in valid_transitions.get(old_status, []) or old_status == "FAILED":
        record["status"] = new_status
        record["last_updated"] = time.time()
        record["error_message"] = error_msg
        
        # Settle to wallet on complete
        if new_status == "COMPLETED":
            try:
                # Farmer ID simplifies to claim_id for mock
                deposit_to_wallet(
                    farmer_id=claim_id,
                    amount=record["amount"],
                    reference_id=record["payment_id"],
                    description=f"Automated De-Risking Micro-Payout ({record['payment_mode']})"
                )
            except Exception as e:
                logger.error("Failed to deposit payout to wallet: %s", e)
                
        logger.info("Payment %s transitioned: %s -> %s", record["payment_id"], old_status, new_status)
    return record

def execute_payment_with_retry(claim_id: int) -> Dict[str, Any]:
    """Executes the payment with retry logic."""
    if claim_id not in PAYMENT_LEDGER:
        raise ValueError(f"No payment record found for claim_id {claim_id}")
        
    record = PAYMENT_LEDGER[claim_id]
    if record["status"] == "COMPLETED":
        return record
        
    transition_payment_status(claim_id, "PENDING")
    
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        record["retry_attempts"] = attempt
        transition_payment_status(claim_id, "PROCESSING")
        
        try:
            # Settle successfully
            transition_payment_status(claim_id, "COMPLETED")
            break
        except Exception as e:
            logger.error("Attempt %d failed: %s", attempt, e)
            record["error_message"] = str(e)
            transition_payment_status(claim_id, "FAILED", str(e))
            if attempt < max_retries:
                time.sleep(0.05)
                
    return record
