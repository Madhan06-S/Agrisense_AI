import logging
import time
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from app.core.security import decode_token as decode_jwt

logger = logging.getLogger(__name__)
router = APIRouter()

# In-memory notifications database (user_id -> list of notifications)
# Structure: id, user_id, title, message, type, is_read, created_at, action_url
USER_NOTIFICATIONS: Dict[str, List[Dict[str, Any]]] = {}

def get_user_id_from_req(request: Request) -> str:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]
    if not token:
        # Fallback to a default user ID for demo purposes if not logged in
        return "1"
    try:
        payload = decode_jwt(token)
        return str(payload.get("sub"))
    except Exception:
        return "1"

def seed_notifications_for_user(user_id: str):
    if user_id not in USER_NOTIFICATIONS:
        USER_NOTIFICATIONS[user_id] = [
            {
                "id": f"notif-1",
                "title": "Claim #12 Approved",
                "message": "Crop damage verification complete. ₹25,000 will be credited to your linked Aadhaar bank account within 3 working days.",
                "type": "payment",
                "is_read": False,
                "created_at": time.time() - 3600 * 2, # 2 hours ago
                "action_url": "/dashboard/farmer"
            },
            {
                "id": "notif-2",
                "title": "Weather Warning",
                "message": "Heavy rainfall alert: IMD predicts heavy rainfall (70-110mm) in your district tomorrow. Take preventive measures for standing crops.",
                "type": "alert",
                "is_read": False,
                "created_at": time.time() - 3600 * 5, # 5 hours ago
                "action_url": "/dashboard/farmer/copilot"
            },
            {
                "id": "notif-3",
                "title": "Additional Photos Needed",
                "message": "Please submit additional close-up photos of crop damage for Patel Cotton Fields (Claim #13) to expedite processing.",
                "type": "claim_update",
                "is_read": False,
                "created_at": time.time() - 3600 * 24, # 1 day ago
                "action_url": "/dashboard/farmer"
            }
        ]

@router.get("/")
async def get_notifications(request: Request):
    user_id = get_user_id_from_req(request)
    seed_notifications_for_user(user_id)
    return USER_NOTIFICATIONS[user_id]

@router.get("/unread-count")
async def get_unread_count(request: Request):
    user_id = get_user_id_from_req(request)
    seed_notifications_for_user(user_id)
    unread_count = sum(1 for n in USER_NOTIFICATIONS[user_id] if not n["is_read"])
    return {"unread_count": unread_count}

@router.post("/{id}/read")
async def mark_read(id: str, request: Request):
    user_id = get_user_id_from_req(request)
    seed_notifications_for_user(user_id)
    for n in USER_NOTIFICATIONS[user_id]:
        if n["id"] == id:
            n["is_read"] = True
            return {"message": "Notification marked as read"}
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Notification not found")

@router.post("/read-all")
async def mark_all_read(request: Request):
    user_id = get_user_id_from_req(request)
    seed_notifications_for_user(user_id)
    for n in USER_NOTIFICATIONS[user_id]:
        n["is_read"] = True
    return {"message": "All notifications marked as read"}

# Add helper endpoint to trigger a demo notification
@router.post("/trigger-demo-notif")
async def trigger_demo_notif(title: str, message: str, type: str, request: Request):
    user_id = get_user_id_from_req(request)
    seed_notifications_for_user(user_id)
    new_notif = {
        "id": f"notif-demo-{int(time.time())}",
        "title": title,
        "message": message,
        "type": type,
        "is_read": False,
        "created_at": time.time(),
        "action_url": "/dashboard/farmer"
    }
    USER_NOTIFICATIONS[user_id].insert(0, new_notif)
    return {"message": "Demo notification triggered", "notification": new_notif}
