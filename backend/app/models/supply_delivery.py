from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Date
from sqlalchemy.orm import relationship
from app.core.database import Base


class SupplyDelivery(Base):
    """
    Records a single cooperative/aggregator delivery by a farmer.
    Used as the data source for the Supply Chain Reliability factor
    in the alternative credit score.
    """
    __tablename__ = "supply_deliveries"

    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    cooperative_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    delivery_date = Column(Date, nullable=False)
    crop_name = Column(String(100), nullable=False)

    # Quantity promised vs delivered (kg)
    quantity_promised_kg = Column(Float, nullable=False)
    quantity_delivered_kg = Column(Float, nullable=False)

    # On-time flag (cooperative records whether delivery was within agreed window)
    on_time = Column(String(10), default="yes")  # "yes" | "no" | "partial"

    buyer_name = Column(String(150), nullable=True)   # e.g. "Sahyadri FPC", "ITC e-choupal"

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    farmer = relationship("User", foreign_keys=[farmer_id], lazy="select")

    def __repr__(self):
        return f"<SupplyDelivery id={self.id} farmer={self.farmer_id} crop={self.crop_name} delivered={self.quantity_delivered_kg}/{self.quantity_promised_kg}>"
