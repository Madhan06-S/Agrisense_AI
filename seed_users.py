import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime

from app.core.database import AsyncSessionLocal
from app.models.models import User

async def seed_users():
    async with AsyncSessionLocal() as db:
        users = [
            {
                "phone": "9876543210",
                "email": "ramesh.patel@agrisense.gov.in",
                "aadhaar_number": "123412341230",
                "hashed_password": "pbkdf2:sha256:260000$mock_hash_placeholder",
                "role": "farmer",
                "is_active": True
            },
            {
                "phone": "9876543211",
                "email": "sunita.devi@agrisense.gov.in",
                "aadhaar_number": "123412341231",
                "hashed_password": "pbkdf2:sha256:260000$mock_hash_placeholder",
                "role": "farmer",
                "is_active": True
            },
            {
                "phone": "9876543299",
                "email": "priya.sharma@agrisense.gov.in",
                "aadhaar_number": "987698769899",
                "hashed_password": "pbkdf2:sha256:260000$mock_hash_placeholder",
                "role": "officer",
                "pin": "1234",
                "is_active": True
            }
        ]

        for u in users:
            stmt = select(User).where(User.phone == u["phone"])
            res = await db.execute(stmt)
            existing = res.scalars().first()
            if not existing:
                user = User(
                    email=u["email"],
                    phone=u["phone"],
                    aadhaar_number=u["aadhaar_number"],
                    hashed_password=u["hashed_password"],
                    role=u["role"],
                    pin=u.get("pin"),
                    is_active=u["is_active"]
                )
                db.add(user)
                print(f"Created: {u['phone']} ({u['role']})")
            else:
                existing.is_active = True
                existing.role = u["role"]
                if u.get("pin"):
                    existing.pin = u["pin"]
                print(f"Ensured: {u['phone']} is active with role {u['role']}")
        
        await db.commit()
    print("Done.")

if __name__ == "__main__":
    asyncio.run(seed_users())
