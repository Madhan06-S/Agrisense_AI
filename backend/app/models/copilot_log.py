from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from app.core.database import Base


class CopilotLog(Base):
    __tablename__ = "copilot_logs"

    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(Integer, nullable=True, index=True)
    farm_id = Column(Integer, ForeignKey("farms.id", ondelete="CASCADE"), nullable=False, index=True)
    query_text = Column(Text, nullable=True)
    mode = Column(String(20), nullable=False)  # 'llm' or 'heuristic'
    response_text = Column(Text, nullable=False)
    tokens_used = Column(Integer, default=0)
    latency_ms = Column(Float, default=0.0)
    language = Column(String(10), default="en-IN")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)

    def __repr__(self):
        return f"<CopilotLog id={self.id} farm_id={self.farm_id} mode={self.mode} latency_ms={self.latency_ms}>"
