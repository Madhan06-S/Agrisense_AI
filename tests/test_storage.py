import os
import pytest
import shutil
from app.core.storage import LocalStorage

def test_local_storage():
    test_dir = "/tmp/agrisense_test_run"
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)
        
    storage = LocalStorage(base_dir=test_dir)
    
    # Create a dummy file to upload
    local_file = "/tmp/test_upload_file.txt"
    with open(local_file, "w") as f:
        f.write("Hello, AgriSense!")
        
    dest_path = "farm-1/sentinel-2/2026-07-15/test.txt"
    meta = {
        "satellite_source": "sentinel-2",
        "acquisition_date": "2026-07-15",
        "processed": "false"
    }
    
    # Test upload
    uploaded_key = storage.upload(local_file, dest_path, metadata=meta)
    assert uploaded_key == dest_path
    
    # Test exists
    assert storage.exists(dest_path)
    
    # Test companion metadata file exists
    assert os.path.exists(os.path.join(test_dir, dest_path + ".meta.json"))
    
    # Test list
    files = storage.list("farm-1/sentinel-2/2026-07-15")
    assert len(files) == 1
    assert files[0] == dest_path
    
    # Test download
    down_path = "/tmp/test_downloaded.txt"
    if os.path.exists(down_path):
        os.remove(down_path)
    storage.download(dest_path, down_path)
    assert os.path.exists(down_path)
    with open(down_path, "r") as f:
        assert f.read() == "Hello, AgriSense!"
        
    # Test delete
    storage.delete(dest_path)
    assert not storage.exists(dest_path)
    assert not os.path.exists(os.path.join(test_dir, dest_path + ".meta.json"))
    
    # Clean up
    if os.path.exists(local_file):
        os.remove(local_file)
    if os.path.exists(down_path):
        os.remove(down_path)
    if os.path.exists(test_dir):
        shutil.rmtree(test_dir)
