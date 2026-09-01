import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timezone, date
from sqlalchemy import select, text
from app.core.database import AsyncSessionLocal, create_tables
from app.core.security import hash_password
from app.models import (
    User, Farm, Claim, DamageAssessment,
    InsuranceScheme, InsurancePolicy, PolicyCoverage, ParametricTriggerConfig
)
from app.models.user import UserRole
from app.models.claim import ClaimType, ClaimStatus
from app.ml.fusion_engine import run_fusion_pipeline
from app.decision.engine import apply_traffic_light_decision

async def seed():
    print("🌱 Initializing database tables...")
    try:
        await create_tables()
    except Exception as e:
        print(f"⚠️ Skipped PostgreSQL-specific alters (expected on SQLite): {e}")

    async with AsyncSessionLocal() as db:
        # Create users
        users_data = [
            {
                "phone": "9876543210",
                "full_name": "Ramesh Patel",
                "role": UserRole.farmer,
                "email": "ramesh@example.com",
                "password_hash": hash_password("password123"),
                "aadhaar_number": "123456789012",
                "state": "Maharashtra",
                "district": "Pune",
                "village": "Khed",
                "is_active": True
            },
            {
                "phone": "9876543211",
                "full_name": "Sunita Devi",
                "role": UserRole.farmer,
                "email": "sunita@example.com",
                "password_hash": hash_password("password123"),
                "aadhaar_number": "987654321098",
                "state": "Uttar Pradesh",
                "district": "Varanasi",
                "village": "Rohania",
                "is_active": True
            },
            {
                "phone": "9876543299",
                "full_name": "Priya Sharma",
                "role": UserRole.officer,
                "email": "priya@agrisense.ai",
                "password_hash": hash_password("officer123"),
                "state": "Maharashtra",
                "district": "Pune",
                "is_active": True
            },
        ]

        users = {}
        for u in users_data:
            stmt = select(User).where(User.phone == u["phone"])
            res = await db.execute(stmt)
            existing = res.scalars().first()
            if not existing:
                user = User(**u)
                db.add(user)
                await db.flush()
                users[u["role"].value] = user
                print(f"Created {u['role'].value}: {u['full_name']} ({u['phone']})")
            else:
                users[existing.role.value] = existing
                print(f"Found existing: {existing.full_name}")

        # Create farms for Ramesh
        ramesh_stmt = select(User).where(User.phone == "9876543210")
        ramesh_res = await db.execute(ramesh_stmt)
        ramesh_user = ramesh_res.scalars().first()
        farmer_id = ramesh_user.id
        farms_data = [
            {
                "farmer_id": farmer_id,
                "name": "Patel Rice Farm",
                "crop_type": "Rice",
                "area_hectares": 2.5,
                "sowing_date": date(2026, 6, 15),
                "insurance_policy_number": "PMFBY-MH-2026-001234"
            },
            {
                "farmer_id": farmer_id,
                "name": "Patel Cotton Fields",
                "crop_type": "Cotton",
                "area_hectares": 4.0,
                "sowing_date": date(2026, 6, 10),
                "insurance_policy_number": "PMFBY-MH-2026-001235"
            },
        ]

        farms = []
        for f in farms_data:
            stmt = select(Farm).where(Farm.name == f["name"], Farm.farmer_id == f["farmer_id"])
            res = await db.execute(stmt)
            existing = res.scalars().first()
            if not existing:
                farm = Farm(**f)
                db.add(farm)
                await db.flush()
                farms.append(farm)
                print(f"Created farm: {farm.name}")
            else:
                farms.append(existing)

        # Create supported insurance schemes: PMFBY and RWBCIS
        from app.models.insurance_models import InsuranceScheme, InsurancePolicy, ParametricTriggerConfig
        schemes_data = [
            {
                "code": "PMFBY",
                "name": "Pradhan Mantri Fasal Bima Yojana",
                "type": "YIELD_BASED",
                "description": "Yield-Based Crop Insurance Scheme",
                "active": True
            },
            {
                "code": "RWBCIS",
                "name": "Restructured Weather Based Crop Insurance Scheme",
                "type": "WEATHER_INDEX_PARAMETRIC",
                "description": "Weather-Based Index Crop Protection Scheme",
                "active": True
            }
        ]

        schemes_map = {}
        for s in schemes_data:
            stmt_s = select(InsuranceScheme).where(InsuranceScheme.code == s["code"])
            res_s = await db.execute(stmt_s)
            existing_s = res_s.scalars().first()
            if not existing_s:
                scheme_obj = InsuranceScheme(**s)
                db.add(scheme_obj)
                await db.flush()
                schemes_map[s["code"]] = scheme_obj
                print(f"Created scheme: {scheme_obj.code} ({scheme_obj.name})")
            else:
                schemes_map[existing_s.code] = existing_s

        # Link Insurance Policies for farms
        policies_data = [
            {
                "policy_number": "PMFBY-MH-2026-001234",
                "scheme_id": schemes_map["PMFBY"].id,
                "farm_id": farms[0].id,
                "crop": farms[0].crop_type,
                "season": "Kharif",
                "sum_insured": 120000.0,
                "status": "ACTIVE"
            },
            {
                "policy_number": "PMFBY-MH-2026-001235",
                "scheme_id": schemes_map["RWBCIS"].id,
                "farm_id": farms[1].id,
                "crop": farms[1].crop_type,
                "season": "Kharif",
                "sum_insured": 150000.0,
                "status": "ACTIVE"
            }
        ]

        for p in policies_data:
            stmt_p = select(InsurancePolicy).where(InsurancePolicy.policy_number == p["policy_number"])
            res_p = await db.execute(stmt_p)
            existing_p = res_p.scalars().first()
            if not existing_p:
                pol_obj = InsurancePolicy(**p)
                db.add(pol_obj)
                await db.flush()
                print(f"Created policy #{pol_obj.policy_number} for Farm #{pol_obj.farm_id}")

        # Create claims with different types for traffic light demo
        claims_data = [
            {"farm_id": farms[0].id, "farmer_id": farmer_id, "claim_type": ClaimType.flood, "description": "Heavy flooding in rice field", "status": ClaimStatus.submitted},
            {"farm_id": farms[0].id, "farmer_id": farmer_id, "claim_type": ClaimType.drought, "description": "Severe drought with zero rainfall", "status": ClaimStatus.submitted},
            {"farm_id": farms[1].id, "farmer_id": farmer_id, "claim_type": ClaimType.pest, "description": "Brown plant hopper infestation", "status": ClaimStatus.submitted},
            {"farm_id": farms[1].id, "farmer_id": farmer_id, "claim_type": ClaimType.cyclone, "description": "Cyclone damage to cotton crop", "status": ClaimStatus.submitted},
        ]

        for c in claims_data:
            # Delete old claim of same type and farm to allow clean seeding
            stmt_del_c = select(Claim).where(Claim.farm_id == c["farm_id"], Claim.claim_type == c["claim_type"])
            res_del_c = await db.execute(stmt_del_c)
            old_c = res_del_c.scalars().first()
            if old_c:
                # Delete corresponding assessments first
                await db.execute(text(f"DELETE FROM damage_assessments WHERE claim_id = {old_c.id}"))
                await db.delete(old_c)
                await db.flush()

            claim = Claim(**c)
            db.add(claim)
            await db.flush()
            
            # Run AI pipeline to create assessments
            await run_fusion_pipeline(claim.id, db)
            await apply_traffic_light_decision(claim.id, db)
            await db.refresh(claim)
            
            print(f"Created claim #{claim.id}: {claim.claim_type.value} -> {claim.status.value}")

        await db.commit()

if __name__ == "__main__":
    asyncio.run(seed())
    print("\nSeed complete. Test users:")
    print("  Farmer: 9876543210")
    print("  Officer: 9876543299")
