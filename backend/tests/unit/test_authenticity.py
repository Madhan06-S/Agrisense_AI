import pytest
import io
from PIL import Image
from app.ml.image_validator import check_photo_authenticity


def create_test_image(make: str = "Apple", model: str = "iPhone 13", fresh: bool = True) -> bytes:
    """Helper to generate a test JPEG with optional EXIF headers."""
    img = Image.new("RGB", (800, 600), color=(34, 139, 34))
    exif = img.getexif()
    if make:
        exif[271] = make  # Make
    if model:
        exif[272] = model  # Model
    if fresh:
        from datetime import datetime, timezone
        exif[36867] = datetime.now(timezone.utc).strftime("%Y:%m:%d %H:%M:%S")  # DateTimeOriginal
    
    buf = io.BytesIO()
    img.save(buf, format="JPEG", exif=exif)
    return buf.getvalue()


def test_fresh_photo_authenticity_verification():
    img_bytes = create_test_image(make="Apple", model="iPhone 14")
    farm_loc = (18.5204, 73.8567)
    client_loc = (18.5205, 73.8568)  # ~15 meters away

    res = check_photo_authenticity(
        file_bytes=img_bytes,
        farm_location=farm_loc,
        client_location=client_loc,
        existing_hashes=set()
    )

    assert res["verified"] is True
    assert len(res["authenticity_flags"]) == 0
    assert res["camera_model"] == "Apple iPhone 14"


def test_screenshot_flag_detection():
    # Image without EXIF Make/Model
    img_bytes = create_test_image(make="", model="")
    farm_loc = (18.5204, 73.8567)
    client_loc = (18.5205, 73.8568)

    res = check_photo_authenticity(
        file_bytes=img_bytes,
        farm_location=farm_loc,
        client_location=client_loc
    )

    assert res["verified"] is False
    assert "possible_screenshot" in res["authenticity_flags"]


def test_duplicate_photo_flag_detection():
    img_bytes = create_test_image(make="Samsung", model="Galaxy S22")
    import hashlib
    sha256 = hashlib.sha256(img_bytes).hexdigest()

    res = check_photo_authenticity(
        file_bytes=img_bytes,
        existing_hashes={sha256}
    )

    assert res["verified"] is False
    assert "duplicate_photo" in res["authenticity_flags"]


def test_location_mismatch_flag_detection():
    img_bytes = create_test_image(make="Google", model="Pixel 7")
    farm_loc = (18.5204, 73.8567)
    client_loc = (19.0760, 72.8777)  # Mumbai (~120km away)

    res = check_photo_authenticity(
        file_bytes=img_bytes,
        farm_location=farm_loc,
        client_location=client_loc
    )

    assert res["verified"] is False
    assert "location_mismatch" in res["authenticity_flags"]
