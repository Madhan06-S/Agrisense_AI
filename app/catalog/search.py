import logging
from typing import Dict, Any, List, Optional
from sqlalchemy import select, and_, or_
from app.models.models import Farm

logger = logging.getLogger(__name__)

# Initialize Elasticsearch if package is installed
es_client = None
try:
    from elasticsearch import Elasticsearch
    # Assume ES runs locally for the environment configuration
    es_client = Elasticsearch("http://localhost:9200", request_timeout=2)
except Exception:
    pass

async def index_farm_metadata_es(farm_id: int, doc: Dict[str, Any]) -> None:
    """Helper to register a farm document in the Elasticsearch index."""
    if not es_client:
        return
    try:
        es_client.index(index="farms", id=str(farm_id), document=doc)
    except Exception as e:
        logger.warning(f"Elasticsearch indexing skipped/failed for farm {farm_id}: {e}")

async def search_farms_catalog(
    db,
    query_str: str,
    state: Optional[str] = None,
    district: Optional[str] = None,
    crop_type: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Performs full-text and faceted search across farms using Elasticsearch.
    Falls back gracefully to a SQL database query using ILIKE if ES is unavailable.
    """
    if es_client:
        try:
            must_clause = []
            if query_str:
                must_clause.append({
                    "multi_match": {
                        "query": query_str,
                        "fields": ["name", "village", "taluka", "crop_type", "khasra_number"]
                    }
                })
            else:
                must_clause.append({"match_all": {}})

            filters = []
            if state:
                filters.append({"term": {"state.keyword": state}})
            if district:
                filters.append({"term": {"district.keyword": district}})
            if crop_type:
                filters.append({"term": {"crop_type.keyword": crop_type}})

            body = {
                "query": {
                    "bool": {
                        "must": must_clause,
                        "filter": filters
                    }
                }
            }
            res = es_client.search(index="farms", body=body)
            hits = res["hits"]["hits"]
            farm_ids = [int(h["_id"]) for h in hits]
            
            if farm_ids:
                stmt = select(Farm).where(Farm.id.in_(farm_ids), Farm.is_deleted == False)
                db_res = await db.execute(stmt)
                farms = db_res.scalars().all()
                # Maintain Elasticsearch hit order
                farm_map = {f.id: f for f in farms}
                return [{
                    "id": fid,
                    "name": farm_map[fid].name,
                    "crop_type": farm_map[fid].crop_type,
                    "state": farm_map[fid].state,
                    "district": farm_map[fid].district,
                    "taluka": farm_map[fid].taluka,
                    "village": farm_map[fid].village,
                    "khasra_number": farm_map[fid].khasra_number,
                    "area_hectares": farm_map[fid].area_hectares,
                    "metadata": farm_map[fid].extra_metadata or {}
                } for fid in farm_ids if fid in farm_map]
        except Exception as e:
            logger.warning(f"Elasticsearch search failed: {e}. Falling back to PostgreSQL query.")

    # Fallback to database queries
    stmt = select(Farm).where(Farm.is_deleted == False)
    conditions = []
    
    if query_str:
        pattern = f"%{query_str}%"
        conditions.append(or_(
            Farm.name.ilike(pattern),
            Farm.village.ilike(pattern),
            Farm.taluka.ilike(pattern),
            Farm.crop_type.ilike(pattern),
            Farm.khasra_number.ilike(pattern)
        ))

    if state:
        conditions.append(Farm.state == state)
    if district:
        conditions.append(Farm.district == district)
    if crop_type:
        conditions.append(Farm.crop_type == crop_type)

    if conditions:
        stmt = stmt.where(and_(*conditions))

    res = await db.execute(stmt)
    farms = res.scalars().all()
    
    return [{
        "id": f.id,
        "name": f.name,
        "crop_type": f.crop_type,
        "state": f.state,
        "district": f.district,
        "taluka": f.taluka,
        "village": f.village,
        "khasra_number": f.khasra_number,
        "area_hectares": f.area_hectares,
        "metadata": f.extra_metadata or {}
    } for f in farms]
