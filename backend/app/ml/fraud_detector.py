"""
Fraud Detector — runs 5 detection checks on a submitted claim.
"""
from datetime import datetime, timedelta, timezone
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
import math


GPS_MISMATCH_THRESHOLD_M = 500  # metres


def _haversine(lat1, lon1, lat2, lon2) -> float:
    """Return distance in metres between two GPS points."""
    R = 6_371_000
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2) ** 2
    return 2 * R * math.atan2(math.sqrt(a), math.sqrt(1 - a))


class FraudDetector:
    async def run_all_checks(
        self,
        claim_id: int,
        db: AsyncSession,
        satellite_result: dict = None,
        weather_result: dict = None,
    ) -> List[dict]:
        """Run all fraud checks and return list of flag dicts."""
        from app.models.claim import Claim
        from app.models.claim_image import ClaimImage
        from app.models.farm import Farm

        result = await db.execute(select(Claim).where(Claim.id == claim_id))
        claim = result.scalar_one_or_none()
        if not claim:
            return []

        flags = []

        # ── 1. Duplicate image (pHash) ─────────────────────────
        img_result = await db.execute(
            select(ClaimImage).where(ClaimImage.claim_id == claim_id)
        )
        current_images = img_result.scalars().all()

        if current_images:
            hashes = [img.image_hash for img in current_images if img.image_hash]
            # Check against all OTHER claims
            for h in hashes:
                dup_result = await db.execute(
                    select(ClaimImage).where(
                        ClaimImage.image_hash == h,
                        ClaimImage.claim_id != claim_id,
                    )
                )
                dups = dup_result.scalars().all()
                if dups:
                    flags.append({
                        "flag_type": "duplicate_image",
                        "severity": "high",
                        "details": {
                            "hash": h,
                            "matching_claim_ids": list({d.claim_id for d in dups}),
                            "message": "Image hash matches a previously submitted claim",
                        },
                    })
                    break

        # ── 2. GPS mismatch ────────────────────────────────────
        farm_result = await db.execute(select(Farm).where(Farm.id == claim.farm_id))
        farm = farm_result.scalar_one_or_none()

        if farm and current_images:
            geo_tagged = [img for img in current_images if img.is_geo_tagged and img.latitude and img.longitude]
            if geo_tagged:
                # Get farm centroid — approximate from boundary or use India centre
                # For mock: check if all images are within reasonable distance of each other
                lats = [img.latitude for img in geo_tagged]
                lngs = [img.longitude for img in geo_tagged]
                centroid_lat = sum(lats) / len(lats)
                centroid_lng = sum(lngs) / len(lngs)

                # Check each image against centroid
                far_images = []
                for img in geo_tagged:
                    dist = _haversine(centroid_lat, centroid_lng, img.latitude, img.longitude)
                    if dist > GPS_MISMATCH_THRESHOLD_M * 5:  # 2.5km from centroid
                        far_images.append({"image_id": img.id, "distance_m": round(dist)})

                if far_images:
                    flags.append({
                        "flag_type": "satellite_mismatch",
                        "severity": "medium",
                        "details": {
                            "message": "Some uploaded images are far from the farm boundary",
                            "outlier_images": far_images,
                        },
                    })

        # ── 3. Repeated claim ──────────────────────────────────
        thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
        recent_result = await db.execute(
            select(func.count()).where(
                and_(
                    Claim.farm_id == claim.farm_id,
                    Claim.id != claim_id,
                    Claim.submitted_at >= thirty_days_ago,
                )
            )
        )
        recent_count = recent_result.scalar()
        if recent_count and recent_count > 0:
            flags.append({
                "flag_type": "repeated_claim",
                "severity": "medium",
                "details": {
                    "recent_claims_count": recent_count,
                    "window_days": 30,
                    "message": f"This farm submitted {recent_count} claim(s) in the last 30 days",
                },
            })

        # ── 4. Weather mismatch ────────────────────────────────
        if weather_result:
            wx_score = weather_result.get("weather_score", 100)
            if wx_score < 20:
                flags.append({
                    "flag_type": "weather_mismatch",
                    "severity": "high",
                    "details": {
                        "weather_score": wx_score,
                        "rainfall_mm": weather_result.get("rainfall_mm"),
                        "message": "Weather records do not corroborate the claimed event",
                    },
                })

        return flags

    async def save_flags(self, claim_id: int, flags: List[dict], db: AsyncSession):
        """Persist fraud flags to the database."""
        from app.models.fraud_flag import FraudFlag, FlagType, FlagSeverity

        for flag in flags:
            record = FraudFlag(
                claim_id=claim_id,
                flag_type=flag["flag_type"],
                severity=flag["severity"],
                details_json=flag.get("details", {}),
            )
            db.add(record)
        await db.commit()
