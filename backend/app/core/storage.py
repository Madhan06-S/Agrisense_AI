import os
import shutil
import json
import boto3
from botocore.client import Config
from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from app.core.config import settings

class StorageBackend(ABC):
    @abstractmethod
    def upload(self, file_path: str, destination: str, metadata: Optional[Dict[str, str]] = None) -> str:
        """
        Uploads a file to the storage backend and tags it with metadata.
        Returns the destination key/path identifier.
        """
        pass

    @abstractmethod
    def download(self, source: str, destination: str) -> str:
        """
        Downloads a file from the storage backend.
        Returns the destination local path.
        """
        pass

    @abstractmethod
    def delete(self, path: str) -> bool:
        """
        Deletes a file from the storage backend.
        Returns True if successful, False otherwise.
        """
        pass

    @abstractmethod
    def list(self, prefix: str) -> List[str]:
        """
        Lists file keys/paths starting with the prefix.
        """
        pass

    @abstractmethod
    def exists(self, path: str) -> bool:
        """
        Checks if a file exists in the storage.
        """
        pass

    @abstractmethod
    def get_url(self, path: str, expiry: int = 3600) -> str:
        """
        Generates a presigned URL (for MinIO/S3) or file URL (for Local) to access the file.
        """
        pass


class LocalStorage(StorageBackend):
    def __init__(self, base_dir: Optional[str] = None):
        self.base_dir = base_dir or settings.LOCAL_STORAGE_DIR
        os.makedirs(self.base_dir, exist_ok=True)

    def _get_full_path(self, path: str) -> str:
        # Prevent escaping target base directory
        clean_path = path.lstrip("/")
        return os.path.join(self.base_dir, clean_path)

    def upload(self, file_path: str, destination: str, metadata: Optional[Dict[str, str]] = None) -> str:
        full_dest = self._get_full_path(destination)
        os.makedirs(os.path.dirname(full_dest), exist_ok=True)
        shutil.copy2(file_path, full_dest)
        
        # Store metadata in a companion .meta.json file locally
        if metadata:
            meta_path = full_dest + ".meta.json"
            with open(meta_path, "w") as f:
                json.dump(metadata, f, indent=2)
                
        return destination

    def download(self, source: str, destination: str) -> str:
        full_src = self._get_full_path(source)
        if not os.path.exists(full_src):
            raise FileNotFoundError(f"Local file source '{source}' not found.")
        
        os.makedirs(os.path.dirname(destination), exist_ok=True)
        shutil.copy2(full_src, destination)
        return destination

    def delete(self, path: str) -> bool:
        full_path = self._get_full_path(path)
        meta_path = full_path + ".meta.json"
        
        success = False
        if os.path.exists(full_path):
            os.remove(full_path)
            success = True
        if os.path.exists(meta_path):
            os.remove(meta_path)
            
        return success

    def list(self, prefix: str) -> List[str]:
        full_prefix_path = self._get_full_path(prefix)
        
        if os.path.isdir(full_prefix_path):
            target_dir = full_prefix_path
            match_prefix = ""
        else:
            target_dir = os.path.dirname(full_prefix_path)
            match_prefix = os.path.basename(full_prefix_path)

        if not os.path.exists(target_dir):
            return []

        results = []
        for root, _, files in os.walk(target_dir):
            for file in files:
                if file.endswith(".meta.json"):
                    continue
                
                full_file = os.path.join(root, file)
                rel_path = os.path.relpath(full_file, self.base_dir)
                
                if not match_prefix or os.path.basename(rel_path).startswith(match_prefix):
                    results.append(rel_path)
                    
        return results

    def exists(self, path: str) -> bool:
        return os.path.exists(self._get_full_path(path))

    def get_url(self, path: str, expiry: int = 3600) -> str:
        full_path = os.path.abspath(self._get_full_path(path))
        return f"file://{full_path}"


class MinIOStorage(StorageBackend):
    def __init__(self):
        self.endpoint = settings.MINIO_ENDPOINT
        self.access_key = settings.MINIO_ACCESS_KEY
        self.secret_key = settings.MINIO_SECRET_KEY
        self.secure = settings.MINIO_SECURE
        self.raw_bucket = settings.MINIO_BUCKET_RAW
        self.processed_bucket = settings.MINIO_BUCKET_PROCESSED
        
        protocol = "https" if self.secure else "http"
        self.s3_client = boto3.client(
            "s3",
            endpoint_url=f"{protocol}://{self.endpoint}",
            aws_access_key_id=self.access_key,
            aws_secret_access_key=self.secret_key,
            config=Config(signature_version="s3v4"),
            region_name="us-east-1"
        )
        self._ensure_buckets()

    def _ensure_buckets(self):
        for bucket in [self.raw_bucket, self.processed_bucket]:
            try:
                self.s3_client.head_bucket(Bucket=bucket)
            except Exception:
                try:
                    self.s3_client.create_bucket(Bucket=bucket)
                except Exception as e:
                    # Gracefully continue if MinIO is offline during static loading/testing
                    pass

    def _get_bucket_and_key(self, path: str) -> tuple:
        clean_path = path.lstrip("/")
        # Automatically partition based on 'processed' keyword in path
        if "processed" in clean_path.lower():
            return self.processed_bucket, clean_path
        return self.raw_bucket, clean_path

    def upload(self, file_path: str, destination: str, metadata: Optional[Dict[str, str]] = None) -> str:
        bucket, key = self._get_bucket_and_key(destination)
        
        extra_args = {}
        if metadata:
            # Combine tags into standard S3 query param tagging string
            tag_string = "&".join([f"{k}={v}" for k, v in metadata.items()])
            extra_args["Tagging"] = tag_string
            extra_args["Metadata"] = metadata

        self.s3_client.upload_file(file_path, bucket, key, ExtraArgs=extra_args)
        return f"{bucket}/{key}"

    def download(self, source: str, destination: str) -> str:
        bucket, key = self._get_bucket_and_key(source)
        # Strip bucket prefix from key if it was included in the source path
        if source.startswith(f"{self.raw_bucket}/"):
            key = source[len(f"{self.raw_bucket}/"):]
            bucket = self.raw_bucket
        elif source.startswith(f"{self.processed_bucket}/"):
            key = source[len(f"{self.processed_bucket}/"):]
            bucket = self.processed_bucket

        os.makedirs(os.path.dirname(destination), exist_ok=True)
        self.s3_client.download_file(bucket, key, destination)
        return destination

    def delete(self, path: str) -> bool:
        bucket, key = self._get_bucket_and_key(path)
        try:
            self.s3_client.delete_object(Bucket=bucket, Key=key)
            return True
        except Exception:
            return False

    def list(self, prefix: str) -> List[str]:
        bucket, clean_prefix = self._get_bucket_and_key(prefix)
        try:
            paginator = self.s3_client.get_paginator("list_objects_v2")
            pages = paginator.paginate(Bucket=bucket, Prefix=clean_prefix)
            
            results = []
            for page in pages:
                for obj in page.get("Contents", []):
                    results.append(f"{bucket}/{obj['Key']}")
            return results
        except Exception:
            return []

    def exists(self, path: str) -> bool:
        bucket, key = self._get_bucket_and_key(path)
        try:
            self.s3_client.head_object(Bucket=bucket, Key=key)
            return True
        except Exception:
            return False

    def get_url(self, path: str, expiry: int = 3600) -> str:
        bucket, key = self._get_bucket_and_key(path)
        if path.startswith(f"{self.raw_bucket}/"):
            key = path[len(f"{self.raw_bucket}/"):]
            bucket = self.raw_bucket
        elif path.startswith(f"{self.processed_bucket}/"):
            key = path[len(f"{self.processed_bucket}/"):]
            bucket = self.processed_bucket

        return self.s3_client.generate_presigned_url(
            "get_object",
            Params={"Bucket": bucket, "Key": key},
            ExpiresIn=expiry
        )


def get_storage_backend() -> StorageBackend:
    """Factory function returning the configured storage backend."""
    if settings.STORAGE_BACKEND == "minio":
        try:
            return MinIOStorage()
        except Exception as e:
            # Graceful local fallback to local storage
            return LocalStorage()
    return LocalStorage()
