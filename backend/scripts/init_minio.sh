#!/bin/sh
# Wait for MinIO to start
echo "Waiting for MinIO to start..."
until curl -s http://minio:9000/minio/health/live; do
  sleep 1
done

echo "Configuring MinIO client..."
mc alias set myminio http://minio:9000 minioadmin minioadminpassword

echo "Creating buckets..."
mc mb --ignore-existing myminio/raw-data
mc mb --ignore-existing myminio/processed-data

echo "Setting lifecycle rules..."
# Create raw data lifecycle policy (Expire after 2 years / 730 days)
cat << 'JSON' > /tmp/lifecycle_raw.json
{
  "Rules": [
    {
      "ID": "raw-data-expiry",
      "Status": "Enabled",
      "Filter": {
        "Prefix": ""
      },
      "Expiration": {
        "Days": 730
      }
    }
  ]
}
JSON

# Create processed data lifecycle policy (Expire after 5 years / 1825 days)
cat << 'JSON' > /tmp/lifecycle_processed.json
{
  "Rules": [
    {
      "ID": "processed-data-expiry",
      "Status": "Enabled",
      "Filter": {
        "Prefix": ""
      },
      "Expiration": {
        "Days": 1825
      }
    }
  ]
}
JSON

mc ilm import myminio/raw-data < /tmp/lifecycle_raw.json
mc ilm import myminio/processed-data < /tmp/lifecycle_processed.json

echo "MinIO initialization completed successfully."
