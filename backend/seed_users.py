import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from app.core.database import AsyncSessionLocal, engine, Base
from app.models import User

async def seed_users():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    async with AsyncSessionLocal() as db:
        users = [
            {
                "full_name": "Ramesh Patel",
                "phone": "9876543210",
                "email": "ramesh.patel@agrisense.gov.in",
                "aadhaar_number": "123412341230",
                "password_hash": "pbkdf2:sha256:260000$mock_hash_placeholder",
                "role": "farmer",
                "is_active": True
            },
            {
                "full_name": "Sunita Devi",
                "phone": "9876543211",
                "email": "sunita.devi@agrisense.gov.in",
                "aadhaar_number": "123412341231",
                "password_hash": "pbkdf2:sha256:260000$mock_hash_placeholder",
                "role": "farmer",
                "is_active": True
            },
            {
                "full_name": "Priya Sharma",
                "phone": "9876543299",
                "email": "priya.sharma@agrisense.gov.in",
                "aadhaar_number": "987698769899",
                "password_hash": "pbkdf2:sha256:260000$mock_hash_placeholder",
                "role": "officer",
                "pin": "1234",
                "is_active": True
            },
            {
                "full_name": "Madhan",
                "phone": "8838803421",
                "email": "madhan@agrisense.gov.in",
                "aadhaar_number": "883880342100",
                "password_hash": "pbkdf2:sha256:260000$mock_hash_placeholder",
                "role": "farmer",
                "is_active": True
            }
        ]

        for u in users:
            stmt = select(User).where(User.phone == u["phone"])
            res = await db.execute(stmt)
            existing = res.scalars().first()
            if not existing:
                user = User(
                    full_name=u["full_name"],
                    email=u["email"],
                    phone=u["phone"],
                    aadhaar_number=u["aadhaar_number"],
                    password_hash=u["password_hash"],
                    role=u["role"],
                    pin=u.get("pin"),
                    is_active=u["is_active"]
                )
                db.add(user)
                print(f"Created: {u['phone']} ({u['role']})")
            else:
                existing.is_active = True
                existing.role = u["role"]
                existing.full_name = u["full_name"]
                if u.get("pin"):
                    existing.pin = u["pin"]
                print(f"Ensured: {u['phone']} is active with role {u['role']}")
        
        await db.commit()
    print("Done.")

if __name__ == "__main__":
    asyncio.run(seed_users())
