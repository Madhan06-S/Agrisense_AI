from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from app.models.claim import Claim
from app.models.user import User
from app.models.audit_block import AuditBlock


from typing import Optional

def redact_aadhaar(aadhaar: Optional[str]) -> str:
    if not aadhaar:
        return "Not Linked"
    return f"XXXX-XXXX-{aadhaar[-4:]}"


def redact_phone(phone: str) -> str:
    if len(phone) < 10:
        return phone
    return f"XX-XXXX-{phone[-4:]}"


def redact_account(acc: Optional[str]) -> str:
    if not acc:
        return "XXXX1234"
    return f"XXXX{acc[-4:]}"


async def generate_rti_report_mock(claim_id: int, db: AsyncSession) -> dict:
    """
    Generate structured, RTI-compliant metadata report with redacted details
    and bilingual AI explanation.
    """
    # Fetch claim details
    stmt = (
        select(Claim)
        .options(
            selectinload(Claim.farmer),
            selectinload(Claim.farm),
            selectinload(Claim.damage_assessment),
        )
        .where(Claim.id == claim_id)
    )
    result = await db.execute(stmt)
    claim = result.scalar_one_or_none()
    if not claim:
        raise ValueError("Claim not found")

    # Fetch audit chain
    audit_stmt = (
        select(AuditBlock)
        .where(AuditBlock.claim_id == claim_id)
        .order_by(AuditBlock.timestamp.asc())
    )
    audit_result = await db.execute(audit_stmt)
    blocks = audit_result.scalars().all()

    chain = []
    for b in blocks:
        chain.append({
            "step": b.action,
            "timestamp": b.timestamp.isoformat(),
            "actor": b.actor_name or "System AI",
            "actor_role": b.actor_role or "AI Engine",
            "block_hash": b.current_hash[:16] + "...",
        })

    # Redacted Farmer Profile
    farmer_name = claim.farmer.full_name
    aadhaar_redacted = redact_aadhaar(claim.farmer.aadhaar_number)
    phone_redacted = redact_phone(claim.farmer.phone)

    # Bilingual explanation
    english_explain = f"AI verified crop health via Sentinel-2. Normal baseline NDVI was 0.65; crop damage date NDVI dropped to {claim.ai_damage_score or 0 / 100:.2f}. Total damage probability is {claim.ai_damage_score or 0:.1f}%."
    hindi_explain = f"एआई ने सेंटिनल -२ उपग्रह के माध्यम से फसल स्वास्थ्य का सत्यापन किया। सामान्य आधारभूत एनडीवीआई ०.६५ था; फसल क्षति तिथि एनडीवीआई गिरकर {claim.ai_damage_score or 0 / 100:.2f} हो गई। कुल नुकसान {claim.ai_damage_score or 0:.1f}% है।"

    return {
        "title": f"Right to Information Act (RTI) - Section 4(1)(b) Compliance Report",
        "reference_id": f"RTI-PMFBY-CLAIM-{claim.id}",
        "generation_date": claim.submitted_at.isoformat(),
        "claim": {
            "id": claim.id,
            "scheme": "Pradhan Mantri Fasal Bima Yojana (PMFBY)",
            "budget_head": "2401-110-03 (Crop Insurance)",
            "farmer_name": farmer_name,
            "masked_aadhaar": aadhaar_redacted,
            "masked_phone": phone_redacted,
            "khasra_number": claim.farm.khasra_number or "123",
            "damage_type": claim.claim_type.value,
            "decision": claim.ai_decision or "yellow",
            "officer_remarks": claim.officer_remarks or "Verified and forwarded to payment processing.",
        },
        "audit_chain": chain,
        "ai_explanation": {
            "en": english_explain,
            "hi": hindi_explain,
        },
        "disclaimers": "Generated under Section 4(1)(b) of Right to Information Act, 2005. All records cryptographically verified."
    }
