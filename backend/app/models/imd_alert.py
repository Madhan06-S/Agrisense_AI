from datetime import datetime, timezone, date
from sqlalchemy import Column, Integer, String, Float, Date, DateTime
from app.core.database import Base


class IMDAlert(Base):
    __tablename__ = "imd_alerts"

    id = Column(Integer, primary_key=True, index=True)
    district = Column(String(100), nullable=False, index=True)
    alert_type = Column(String(50), nullable=False)  # flood | drought | cyclone | hailstorm
    severity = Column(String(50), nullable=False)    # moderate | severe
    
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)

    # Recorded weather values
    rainfall_mm = Column(Float, nullable=True)
    wind_speed = Column(Float, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f"<IMDAlert district={self.district} type={self.alert_type} severity={self.severity}>"
