import logging
from typing import Dict, Any, List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.payments.pmkisan import verify_pm_kisan_dbt
from app.payments.upi import generate_upi_link, generate_qr_code_mock
from app.payments.state_machine import (
    initialize_payment, execute_payment_with_retry,
    PAYMENT_LEDGER, transition_payment_status,
    create_digital_wallet, get_wallet_balance,
    get_wallet_transactions, withdraw_from_wallet, deposit_to_wallet
)
from app.compliance.audit import COMPLIANCE_AUDIT_LOG

logger = logging.getLogger(__name__)
router = APIRouter()

# Schemas
class InitiatePaymentRequest(BaseModel):
    claim_id: int
    amount: float
    farmer_name: str
    aadhaar_number: str
    account_number: str
    ifsc: str
    upi_id: str
    payment_mode: str = "UPI"  # UPI, AEPS, BBPS, CBDC (e₹)

class WalletCreateRequest(BaseModel):
    farmer_id: int

class WalletWithdrawRequest(BaseModel):
    farmer_id: int
    amount: float
    recipient_bank: str  # "SBI-XXXXXXXXXX" format

class MicroPayoutRequest(BaseModel):
    farmer_id: int
    amount: float
    claim_id: str
    description: str = "Automated De-Risking Micro-Payout"

@router.post("/initiate", response_model=Dict[str, Any])
async def start_dbt_payment(payload: InitiatePaymentRequest):
    """
    Initiates a Digital Wallet Transfer for an approved claim.
    Supports: UPI, AEPS, BBPS, e₹ (CBDC).
    """
    try:
        # 1. PM-KISAN check
        kisan = verify_pm_kisan_dbt(payload.aadhaar_number)
        if not kisan["verified"]:
            raise HTTPException(status_code=400, detail=f"PM-KISAN DBT verification failed: {kisan['error']}")
            
        # 2. State Machine Initialize
        payment = initialize_payment(
            claim_id=payload.claim_id,
            amount=payload.amount,
            farmer_name=payload.farmer_name,
            account_number=payload.account_number,
            ifsc=payload.ifsc,
            upi_id=payload.upi_id,
            payment_mode=payload.payment_mode
        )
        
        # 3. Execute (auto-deposits to digital wallet on COMPLETED)
        p_res = execute_payment_with_retry(payload.claim_id)
        
        # 4. Log to Compliance chain
        COMPLIANCE_AUDIT_LOG.append_log(
            action="DIGITAL_WALLET_TRANSFER_PROCESSED",
            details={
                "payment_id": p_res["payment_id"],
                "claim_id": payload.claim_id,
                "amount": payload.amount,
                "payment_mode": payload.payment_mode,
                "status": p_res["status"],
                "digital_signature": p_res["digital_signature"]
            }
        )
        
        # Generate QR code link if UPI mode chosen
        upi_pay_link = None
        upi_qr_mock = None
        if payload.payment_mode == "UPI":
            upi_pay_link = generate_upi_link(payload.upi_id, payload.farmer_name, payload.amount, p_res["payment_id"])
            upi_qr_mock = generate_qr_code_mock(upi_pay_link)
            
        return {
            "dbt_verification": kisan,
            "payment_record": p_res,
            "wallet_balance": get_wallet_balance(payload.claim_id),
            "upi_details": {
                "pay_link": upi_pay_link,
                "qr_code": upi_qr_mock
            } if upi_pay_link else None
        }
    except Exception as e:
        logger.error(f"Error initiating payment: {e}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{payment_id}/status", response_model=Dict[str, Any])
async def get_payment_status(payment_id: str):
    """Checks the status of an ongoing transaction."""
    record = None
    for claim_id, rec in PAYMENT_LEDGER.items():
        if rec["payment_id"] == payment_id:
            record = rec
            break
    if not record:
        raise HTTPException(status_code=404, detail="Payment record not found.")
    return record

@router.post("/{payment_id}/retry", response_model=Dict[str, Any])
async def retry_payment(payment_id: str):
    """Retries a failed payment."""
    claim_id = None
    for cid, rec in PAYMENT_LEDGER.items():
        if rec["payment_id"] == payment_id:
            claim_id = cid
            break
    if claim_id is None:
        raise HTTPException(status_code=404, detail="Payment record not found.")
    p_res = execute_payment_with_retry(claim_id)
    return p_res

@router.get("/reconciliation", response_model=Dict[str, Any])
async def daily_reconciliation_report():
    """Generates daily Digital Wallet Transfer reconciliation logs."""
    ledger_records = list(PAYMENT_LEDGER.values())
    total_amount = sum(r["amount"] for r in ledger_records if r["status"] == "COMPLETED")
    
    return {
        "status": "RECONCILED",
        "date": "2026-07-25",
        "total_settled_amount": total_amount,
        "completed_transactions": [r for r in ledger_records if r["status"] == "COMPLETED"],
        "failed_transactions": [r for r in ledger_records if r["status"] == "FAILED"]
    }

# --- Digital Wallet Routes ---

@router.post("/wallet/create", response_model=Dict[str, Any])
async def create_wallet(payload: WalletCreateRequest):
    """Creates a digital wallet for a farmer (e₹ / AEPS enabled)."""
    try:
        wallet = create_digital_wallet(payload.farmer_id)
        return wallet
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/wallet/{farmer_id}/balance", response_model=Dict[str, Any])
async def get_balance(farmer_id: int):
    """Retrieves the farmer's digital wallet balance."""
    balance = get_wallet_balance(farmer_id)
    return {
        "farmer_id": farmer_id,
        "balance_inr": balance,
        "wallet_type": "e₹ Digital Wallet (AEPS/UPI Enabled)"
    }

@router.post("/wallet/withdraw", response_model=Dict[str, Any])
async def withdraw(payload: WalletWithdrawRequest):
    """Withdraws balance from the digital wallet to a linked bank account."""
    try:
        txn = withdraw_from_wallet(payload.farmer_id, payload.amount, payload.recipient_bank)
        return {
            "status": "success",
            "transaction": txn,
            "remaining_balance": get_wallet_balance(payload.farmer_id)
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/wallet/transactions", response_model=Dict[str, Any])
async def get_transactions(farmer_id: int):
    """Retrieves full transaction history for the farmer's digital wallet."""
    txns = get_wallet_transactions(farmer_id)
    return {
        "farmer_id": farmer_id,
        "total_transactions": len(txns),
        "transactions": txns
    }
