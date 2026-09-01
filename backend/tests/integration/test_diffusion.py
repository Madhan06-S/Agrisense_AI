import pytest
import os
import torch
import numpy as np
from datetime import date
from app.ml.diffusion.model import ConditionalUNet
from app.ml.diffusion.inference import CloudReconstructor, calculate_psnr, calculate_ssim
from app.ml.diffusion.reconstruct import reconstruct_cloudy_images_for_farm
from app.models.models import SatelliteImage, DataPipelineRun
from sqlalchemy import select

def setup_module(module):
    """
    Programmatically exports a lightweight U-Net model to placeholder.onnx
    to enable real ONNX Runtime inference in tests.
    """
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    model_path = os.path.join(base_dir, "app", "ml", "diffusion", "placeholder.onnx")
    
    if not os.path.exists(model_path):
        os.makedirs(os.path.dirname(model_path), exist_ok=True)
        # Create a simplified model
        model = ConditionalUNet(in_channels=10, out_channels=4, emb_dim=64)
        model.eval()
        
        # Export dummy inputs
        x = torch.randn(1, 10, 64, 64, dtype=torch.float32)
        t = torch.randn(1, 1, dtype=torch.float32)
        
        torch.onnx.export(
            model,
            (x, t),
            model_path,
            export_params=True,
            opset_version=14,
            do_constant_folding=True,
            input_names=['input', 'timestep'],
            output_names=['output'],
            dynamic_axes={
                'input': {0: 'batch_size', 2: 'height', 3: 'width'},
                'timestep': {0: 'batch_size'},
                'output': {0: 'batch_size', 2: 'height', 3: 'width'}
            }
        )

def test_pytorch_unet_shape():
    model = ConditionalUNet(in_channels=10, out_channels=4)
    x = torch.randn(2, 10, 128, 128)
    t = torch.randn(2, 1)
    out = model(x, t)
    assert out.shape == (2, 4, 128, 128)

def test_psnr_ssim_metrics():
    # Matching images should yield high quality scores
    img1 = np.ones((4, 32, 32), dtype=np.float32) * 0.5
    img2 = np.ones((4, 32, 32), dtype=np.float32) * 0.5
    
    psnr = calculate_psnr(img1, img2)
    ssim = calculate_ssim(img1, img2)
    
    assert psnr == 100.0
    assert ssim == 1.0
    
    # Mismatched images
    img3 = img1.copy()
    img3[0, 0, 0] = 0.0
    assert calculate_psnr(img1, img3) < 100.0
    assert calculate_ssim(img1, img3) < 1.0

def test_onnx_inference():
    # Load dynamically generated placeholder
    reconstructor = CloudReconstructor()
    
    cloudy = np.random.rand(4, 64, 64).astype(np.float32)
    sar = np.random.rand(2, 64, 64).astype(np.float32)
    prior = np.random.rand(4, 64, 64).astype(np.float32)
    mask = np.ones((64, 64), dtype=np.uint8)
    mask[16:48, 16:48] = 0 # 0 = cloud
    
    out, psnr, ssim, low_quality = reconstructor.reconstruct(cloudy, sar, prior, mask)
    
    assert out.shape == (4, 64, 64)
    assert 0.0 <= np.min(out) <= 1.0
    assert 0.0 <= np.max(out) <= 1.0
    assert isinstance(low_quality, bool)

@pytest.mark.asyncio
async def test_reconstruction_pipeline_integration(db_session):
    # Register user and farm
    from app.models.models import Farm, User
    user = User(
        email="rec_test@agrisense.gov.in",
        phone="9999999999",
        aadhaar_number="123456789012",
        hashed_password="pbkdf2:sha256:260000$mock_hash"
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    farm = Farm(
        owner_id=user.id,
        name="Test Reconstruction Farm",
        crop_type="Wheat",
        sowing_date=date(2026, 6, 1),
        area_hectares=10.0,
        insurance_policy_number="INS-REC-99",
        khasra_number="55",
        state="Punjab",
        district="Jalandhar",
        taluka="Phillaur",
        village="Jandiala",
        boundary="POLYGON((75.5 31.0, 75.6 31.0, 75.6 31.1, 75.5 31.1, 75.5 31.0))"
    )
    db_session.add(farm)
    await db_session.commit()
    await db_session.refresh(farm)
    
    # Add a cloudy Sentinel-2 image
    cloudy_img = SatelliteImage(
        farm_id=farm.id,
        source="sentinel-2",
        acquisition_date=date(2026, 7, 10),
        file_path="farm-1/s2/cloudy.tif",
        cloud_cover=78.0,
        resolution=10.0,
        crs="EPSG:4326",
        is_processed=True
    )
    db_session.add(cloudy_img)
    
    # Add matching Sentinel-1 SAR image
    sar_img = SatelliteImage(
        farm_id=farm.id,
        source="sentinel-1",
        acquisition_date=date(2026, 7, 9),
        file_path="farm-1/s1/sar.tif",
        cloud_cover=0.0,
        resolution=10.0,
        crs="EPSG:4326",
        is_processed=True
    )
    db_session.add(sar_img)
    
    # Add prior clear Sentinel-2 image
    clear_img = SatelliteImage(
        farm_id=farm.id,
        source="sentinel-2",
        acquisition_date=date(2026, 6, 20),
        file_path="farm-1/s2/clear_prior.tif",
        cloud_cover=12.0,
        resolution=10.0,
        crs="EPSG:4326",
        is_processed=True
    )
    db_session.add(clear_img)
    
    # Add pipeline run
    run = DataPipelineRun(
        farm_id=farm.id,
        run_type="pipeline",
        status="PREPROCESSING"
    )
    db_session.add(run)
    await db_session.commit()
    await db_session.refresh(run)
    
    # Trigger reconstruction pipeline
    count = await reconstruct_cloudy_images_for_farm(db_session, farm.id, run.id)
    
    assert count == 1
    
    # Check that a reconstructed image record was added to the DB
    stmt = select(SatelliteImage).where(
        SatelliteImage.farm_id == farm.id,
        SatelliteImage.is_reconstructed == True
    )
    res = await db_session.execute(stmt)
    recon = res.scalars().first()
    assert recon is not None
    assert recon.cloud_cover == 0.0
    assert "reconstruction_metrics" in recon.extra_metadata
