import logging
import hashlib
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy import select, delete
from app.models.models import DatasetVersion, SatelliteImage, FeatureVector

logger = logging.getLogger(__name__)

async def create_dataset_snapshot(db) -> Dict[str, Any]:
    """Generates a raw dictionary snapshot of the current images and feature vectors."""
    # Fetch all images
    img_res = await db.execute(select(SatelliteImage))
    images = img_res.scalars().all()
    
    # Fetch all feature vectors
    fv_res = await db.execute(select(FeatureVector))
    feature_vectors = fv_res.scalars().all()
    
    img_snapshot = []
    for img in images:
        img_snapshot.append({
            "id": img.id,
            "farm_id": img.farm_id,
            "source": img.source,
            "acquisition_date": img.acquisition_date.strftime("%Y-%m-%d") if img.acquisition_date else None,
            "file_path": img.file_path,
            "is_processed": img.is_processed,
            "is_reconstructed": img.is_reconstructed,
            "cloud_cover": img.cloud_cover
        })
        
    fv_snapshot = []
    for fv in feature_vectors:
        fv_snapshot.append({
            "id": fv.id,
            "farm_id": fv.farm_id,
            "date": fv.date.strftime("%Y-%m-%d") if fv.date else None,
            "ndvi": fv.ndvi,
            "ndwi": fv.ndwi,
            "is_valid": fv.is_valid
        })
        
    return {
        "images": img_snapshot,
        "feature_vectors": fv_snapshot
    }

def calculate_checksum(snapshot: Dict[str, Any]) -> str:
    """Computes a SHA256 checksum of the snapshot dictionary."""
    serialized = json.dumps(snapshot, sort_keys=True)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()

async def create_version(
    db, version_tag: str, commit_hash: str, schema_version: str = "1.0"
) -> Optional[DatasetVersion]:
    """
    Creates a new semantic dataset version based on the current state.
    """
    try:
        # Check if version tag already exists
        exist_stmt = select(DatasetVersion).where(DatasetVersion.version == version_tag)
        exist_res = await db.execute(exist_stmt)
        if exist_res.scalars().first():
            logger.warning(f"Dataset version {version_tag} already exists.")
            return None

        # Build snapshot
        snapshot = await create_dataset_snapshot(db)
        checksum = calculate_checksum(snapshot)
        
        db_ver = DatasetVersion(
            version=version_tag,
            timestamp=datetime.utcnow(),
            commit_hash=commit_hash,
            schema_version=schema_version,
            checksum=checksum,
            data=snapshot
        )
        
        db.add(db_ver)
        await db.commit()
        await db.refresh(db_ver)
        logger.info(f"Successfully created dataset version {version_tag} (Checksum: {checksum[:8]})")
        return db_ver
    except Exception as e:
        logger.error(f"Error creating dataset version: {e}")
        return None

async def rollback_to_version(db, version_tag: str) -> bool:
    """
    Rolls back the database state to match the snapshot of the given version_tag.
    Removes records created after the snapshot, and restores modified values.
    """
    try:
        stmt = select(DatasetVersion).where(DatasetVersion.version == version_tag)
        res = await db.execute(stmt)
        ver = res.scalars().first()
        if not ver:
            logger.warning(f"Version {version_tag} not found for rollback.")
            return False

        snapshot = ver.data
        snap_images = {img["id"]: img for img in snapshot.get("images", [])}
        snap_fvs = {fv["id"]: fv for fv in snapshot.get("feature_vectors", [])}

        # 1. Rollback Satellite Images
        all_img_res = await db.execute(select(SatelliteImage))
        all_images = all_img_res.scalars().all()
        for img in all_images:
            if img.id not in snap_images:
                # Delete image if not in snapshot
                await db.delete(img)
            else:
                # Restore state
                snap_img = snap_images[img.id]
                img.file_path = snap_img["file_path"]
                img.is_processed = snap_img["is_processed"]
                img.is_reconstructed = snap_img["is_reconstructed"]
                img.cloud_cover = snap_img["cloud_cover"]

        # 2. Rollback Feature Vectors
        all_fv_res = await db.execute(select(FeatureVector))
        all_fvs = all_fv_res.scalars().all()
        for fv in all_fvs:
            if fv.id not in snap_fvs:
                # Delete feature vector if not in snapshot
                await db.delete(fv)
            else:
                snap_fv = snap_fvs[fv.id]
                fv.ndvi = snap_fv["ndvi"]
                fv.ndwi = snap_fv["ndwi"]
                fv.is_valid = snap_fv["is_valid"]

        await db.commit()
        logger.info(f"Database rolled back successfully to version {version_tag}")
        return True
    except Exception as e:
        logger.error(f"Failed to rollback to version {version_tag}: {e}")
        await db.rollback()
        return False

def diff_versions(version_a: DatasetVersion, version_b: DatasetVersion) -> Dict[str, Any]:
    """
    Calculates differences between two dataset versions.
    """
    snap_a = version_a.data
    snap_b = version_b.data

    imgs_a = {img["id"]: img for img in snap_a.get("images", [])}
    imgs_b = {img["id"]: img for img in snap_b.get("images", [])}

    added_images = [img for id_, img in imgs_b.items() if id_ not in imgs_a]
    removed_images = [img for id_, img in imgs_a.items() if id_ not in imgs_b]
    
    modified_images = []
    for id_, img_b in imgs_b.items():
        if id_ in imgs_a:
            img_a = imgs_a[id_]
            if img_a["is_processed"] != img_b["is_processed"] or img_a["is_reconstructed"] != img_b["is_reconstructed"]:
                modified_images.append({
                    "id": id_,
                    "before": {"is_processed": img_a["is_processed"], "is_reconstructed": img_a["is_reconstructed"]},
                    "after": {"is_processed": img_b["is_processed"], "is_reconstructed": img_b["is_reconstructed"]}
                })

    fvs_a = {fv["id"]: fv for fv in snap_a.get("feature_vectors", [])}
    fvs_b = {fv["id"]: fv for fv in snap_b.get("feature_vectors", [])}

    added_fvs = [fv for id_, fv in fvs_b.items() if id_ not in fvs_a]
    removed_fvs = [fv for id_, fv in fvs_a.items() if id_ not in fvs_b]

    return {
        "version_a": version_a.version,
        "version_b": version_b.version,
        "images": {
            "added_count": len(added_images),
            "removed_count": len(removed_images),
            "modified_count": len(modified_images),
            "added": added_images,
            "removed": removed_images,
            "modified": modified_images
        },
        "feature_vectors": {
            "added_count": len(added_fvs),
            "removed_count": len(removed_fvs),
            "added": added_fvs,
            "removed": removed_fvs
        }
    }
