from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime
from app.core.database import Base


class PFMSTransaction(Base):
    __tablename__ = "pfms_transactions"

    id = Column(Integer, primary_key=True, index=True)
    pfms_transaction_id = Column(String(100), unique=True, index=True, nullable=False)
    
    scheme_code = Column(String(50), default="PMFBY-2025-26")
    component_code = Column(String(50), default="03-01")
    sanction_order_no = Column(String(100), nullable=True)
    sanction_date = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    beneficiary_name = Column(String(200), nullable=False)
    beneficiary_aadhaar = Column(String(50), nullable=True)  # Masked Aadhaar
    beneficiary_account_no = Column(String(50), nullable=False)
    beneficiary_ifsc = Column(String(20), nullable=False)
    
    amount_inr = Column(Float, nullable=False)
    purpose = Column(String(500), nullable=True)
    
    # SANCTIONED | PFMS_UPLOADED | VALIDATED | SENT_TO_BANK | CREDITED | FAILED
    status = Column(String(50), default="SANCTIONED", index=True)

    # Budget Heads
    major_head = Column(String(50), default="2401")
    minor_head = Column(String(50), default="110")
    sub_head = Column(String(50), default="03")

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<PFMSTransaction id={self.pfms_transaction_id} status={self.status} amount={self.amount_inr}>"
