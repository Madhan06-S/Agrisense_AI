import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.config import settings
from app.models.user import User
from app.models.farm import Farm
from app.core.security import create_access_token, hash_password
from app.core.otp_service import verify_otp

@pytest.mark.anyio
async def test_cross_user_claim_rejection(db_session):
    # Setup 2 users and 1 farm owned by User 1
    user1 = User(
        email="user1@example.com",
        phone="9876543201",
        aadhaar_number="111111111111",
        password_hash=hash_password("password123"),
        full_name="User One",
        role="farmer"
    )
    user2 = User(
        email="user2@example.com",
        phone="9876543202",
        aadhaar_number="222222222222",
        password_hash=hash_password("password123"),
        full_name="User Two",
        role="farmer"
    )
    db_session.add_all([user1, user2])
    await db_session.commit()
    await db_session.refresh(user1)
    await db_session.refresh(user2)

    farm1 = Farm(
        farmer_id=user1.id,
        name="User 1 Farm",
        crop_type="Rice",
        area_hectares=2.5,
        insurance_policy_number="POLICY-U1",
        state="Telangana",
        district="Warangal",
        taluka="Warangal",
        village="Narsampet",
        khasra_number="101"
    )

    db_session.add(farm1)
    await db_session.commit()
    await db_session.refresh(farm1)

    # User 2 tries to submit claim for User 1's farm
    token_user2 = create_access_token(subject=user2.id, extra_claims={"phone": user2.phone, "role": user2.role})
    
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        res = await ac.post(
            "/api/v1/claims",
            json={
                "farm_id": farm1.id,
                "claim_type": "flood",
                "description": "Attempting cross-user claim"
            },
            headers={"Authorization": f"Bearer {token_user2}"}
        )
        assert res.status_code == 403
        assert "Farm belongs to another user" in res.json().get("detail", "")

@pytest.mark.anyio
async def test_unauthenticated_payment_and_wallet_calls():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # Payment initiate without token
        res_pay = await ac.post(
            "/api/v1/payments/initiate",
            json={"claim_id": 1, "amount": 5000.0, "farmer_name": "Test", "aadhaar_number": "123456789012", "account_number": "123", "ifsc": "SBIN0001234", "upi_id": "a@upi"}
        )
        assert res_pay.status_code == 401

        # Wallet balance without token
        res_bal = await ac.get("/api/v1/payments/wallet/1/balance")
        assert res_bal.status_code == 401

@pytest.mark.anyio
async def test_demo_only_routes_in_production(monkeypatch):
    # Set ENVIRONMENT to production
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    assert settings.DEMO_MODE is False

    # 1. Verify master OTP is rejected in production
    otp_res = verify_otp("9876543210", "123456")
    assert otp_res["success"] is False

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        # 2. Test inject VCI route in production
        res_vci = await ac.post(
            "/api/v1/afii/test-inject-vci",
            json={"zone_id": 1, "vci_score": 25.0}
        )
        assert res_vci.status_code == 403
        assert "demo mode" in res_vci.json().get("detail", "").lower()
