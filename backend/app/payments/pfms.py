import uuid
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.pfms_transaction import PFMSTransaction
from app.models.claim import Claim, ClaimStatus


def generate_pfms_xml(transactions: list[PFMSTransaction]) -> str:
    """
    Generate government treasury standard PFMS bulk payment XML schema.
    """
    root = ET.Element("PFMSMessage")
    
    header = ET.SubElement(root, "Header")
    ET.SubElement(header, "MessageId").text = str(uuid.uuid4())
    ET.SubElement(header, "CreationDateTime").text = datetime.now(timezone.utc).isoformat()
    ET.SubElement(header, "AgencyCode").text = "AGRI-TELANGANA-05"
    ET.SubElement(header, "SchemeCode").text = "PMFBY-2025-26"
    
    payment_info = ET.SubElement(root, "PaymentInstruction")
    ET.SubElement(payment_info, "TotalAmount").text = str(sum(t.amount_inr for t in transactions))
    ET.SubElement(payment_info, "Currency").text = "INR"
    ET.SubElement(payment_info, "MajorHead").text = "2401"
    ET.SubElement(payment_info, "MinorHead").text = "110"
    ET.SubElement(payment_info, "SubHead").text = "03"
    
    records = ET.SubElement(root, "BeneficiaryRecords")
    for t in transactions:
        rec = ET.SubElement(records, "Record")
        ET.SubElement(rec, "TransactionId").text = t.pfms_transaction_id
        ET.SubElement(rec, "SanctionOrderNo").text = t.sanction_order_no or "AGRI/SAN/2025/0000"
        ET.SubElement(rec, "Name").text = t.beneficiary_name
        ET.SubElement(rec, "AccountNo").text = t.beneficiary_account_no
        ET.SubElement(rec, "IFSC").text = t.beneficiary_ifsc
        ET.SubElement(rec, "Amount").text = str(t.amount_inr)
        ET.SubElement(rec, "Purpose").text = t.purpose or "PMFBY Claim Settlement"
        
    return ET.tostring(root, encoding="utf-8").decode("utf-8")


class PFMSEngine:
    @staticmethod
    async def create_sanction(
        claim: Claim,
        beneficiary_name: str,
        amount: float,
        db: AsyncSession,
    ) -> PFMSTransaction:
        """Create a new PFMS sanctioned transaction entry for an approved claim."""
        transaction_id = f"PFMS-{uuid.uuid4().hex[:12].upper()}"
        sanction_order = f"PMFBY/SANCTION/{datetime.now().year}/{claim.id:04d}"
        
        tx = PFMSTransaction(
            pfms_transaction_id=transaction_id,
            scheme_code="PMFBY-2025-26",
            component_code="03-01",
            sanction_order_no=sanction_order,
            beneficiary_name=beneficiary_name,
            beneficiary_aadhaar=f"XXXX-XXXX-{claim.id:04d}", # Dummy masked Aadhaar
            beneficiary_account_no=f"9182736450{claim.id:02d}", # Dummy beneficiary account
            beneficiary_ifsc="SBIN0020123", # State Bank of India
            amount_inr=amount,
            purpose=f"PMFBY Crop insurance claim settlement for {claim.claim_type.value}",
            status="SANCTIONED",
        )
        
        db.add(tx)
        
        # Link to claim
        claim.pfms_transaction_id = transaction_id
        claim.scheme_code = "PMFBY-2025-26"
        claim.sanction_order_no = sanction_order
        
        await db.commit()
        await db.refresh(tx)
        return tx

    @staticmethod
    async def simulate_bulk_upload(transaction_ids: list[str], db: AsyncSession) -> dict:
        """Simulate uploading XML to PFMS treasury gateway. Moves status to VALIDATED."""
        stmt = select(PFMSTransaction).where(PFMSTransaction.pfms_transaction_id.in_(transaction_ids))
        result = await db.execute(stmt)
        txs = result.scalars().all()
        
        for tx in txs:
            if tx.status == "SANCTIONED":
                tx.status = "PFMS_UPLOADED"
        await db.commit()

        # Simulate bank processing delay and validation status move
        for tx in txs:
            if tx.status == "PFMS_UPLOADED":
                tx.status = "VALIDATED"
        await db.commit()
        
        return {"uploaded_records": len(txs), "status": "VALIDATED"}

    @staticmethod
    async def simulate_bank_credit(transaction_ids: list[str], db: AsyncSession) -> dict:
        """Simulate bank credit callback. Moves status to CREDITED and claim to approved/resolved."""
        stmt = select(PFMSTransaction).where(PFMSTransaction.pfms_transaction_id.in_(transaction_ids))
        result = await db.execute(stmt)
        txs = result.scalars().all()
        
        for tx in txs:
            tx.status = "CREDITED"
            # Update matching claim if resolved
            claim_stmt = select(Claim).where(Claim.pfms_transaction_id == tx.pfms_transaction_id)
            claim_res = await db.execute(claim_stmt)
            claim = claim_res.scalar_one_or_none()
            if claim:
                claim.resolved_at = datetime.now(timezone.utc)
                # Create AuditBlock
                from app.compliance.audit_chain import AuditChainEngine
                await AuditChainEngine.add_block(
                    claim_id=claim.id,
                    action="PAYOUT_INITIATED",
                    actor_id=None,
                    actor_role="System PFMS",
                    actor_name="PFMS Treasury Gateway",
                    db=db,
                )
        await db.commit()
        return {"credited_records": len(txs), "status": "CREDITED"}
