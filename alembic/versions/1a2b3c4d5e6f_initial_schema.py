"""Initial schema

Revision ID: 1a2b3c4d5e6f
Revises: 
Create Date: 2026-07-23

"""
from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry

# revision identifiers, used by Alembic.
revision = '1a2b3c4d5e6f'
down_revision = None
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Enable PostGIS extension
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
    
    # 2. Create users table
    op.create_table(
        'users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('phone', sa.String(), nullable=False),
        sa.Column('aadhaar_number', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('password_reset_token', sa.String(), nullable=True),
        sa.Column('last_login', sa.DateTime(), nullable=True),
        sa.Column('login_attempts', sa.Integer(), nullable=False, server_default='0'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('email'),
        sa.UniqueConstraint('phone'),
        sa.UniqueConstraint('aadhaar_number')
    )
    op.create_index('idx_users_email', 'users', ['email'])
    op.create_index('idx_users_phone', 'users', ['phone'])
    op.create_index('idx_users_aadhaar', 'users', ['aadhaar_number'])

    # 3. Create farms table
    op.create_table(
        'farms',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('owner_id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('crop_type', sa.String(), nullable=False),
        sa.Column('sowing_date', sa.Date(), nullable=False),
        sa.Column('area_hectares', sa.Float(), nullable=False),
        sa.Column('insurance_policy_number', sa.String(), nullable=False),
        sa.Column('boundary', Geometry(geometry_type='POLYGON', srid=4326, from_text='ST_GeomFromEWKT', name='geometry'), nullable=False),
        sa.Column('state', sa.String(), nullable=False),
        sa.Column('district', sa.String(), nullable=False),
        sa.Column('taluka', sa.String(), nullable=False),
        sa.Column('village', sa.String(), nullable=False),
        sa.Column('soil_ph', sa.Float(), nullable=True),
        sa.Column('soil_moisture', sa.Float(), nullable=True),
        sa.Column('soil_type', sa.String(), nullable=True),
        sa.Column('khasra_number', sa.String(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False, server_default='false'),
        sa.ForeignKeyConstraint(['owner_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_farms_owner', 'farms', ['owner_id'])
    op.create_index('idx_farms_crop', 'farms', ['crop_type'])
    op.create_index('idx_farms_district', 'farms', ['district'])

    # 4. Create partitioned satellite_images table
    op.execute("""
        CREATE TABLE satellite_images (
            id SERIAL,
            farm_id INTEGER NOT NULL REFERENCES farms(id),
            source VARCHAR NOT NULL,
            acquisition_date DATE NOT NULL,
            red VARCHAR,
            green VARCHAR,
            blue VARCHAR,
            nir VARCHAR,
            swir1 VARCHAR,
            swir2 VARCHAR,
            cloud_cover DOUBLE PRECISION NOT NULL DEFAULT 0.0,
            resolution DOUBLE PRECISION NOT NULL,
            crs VARCHAR NOT NULL,
            file_path VARCHAR NOT NULL,
            is_processed BOOLEAN NOT NULL DEFAULT FALSE,
            is_reconstructed BOOLEAN NOT NULL DEFAULT FALSE,
            reconstruction_quality DOUBLE PRECISION,
            PRIMARY KEY (farm_id, acquisition_date)
        ) PARTITION BY RANGE (acquisition_date);
    """)
    
    op.execute("CREATE TABLE satellite_images_y2024 PARTITION OF satellite_images FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');")
    op.execute("CREATE TABLE satellite_images_y2025 PARTITION OF satellite_images FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');")
    op.execute("CREATE TABLE satellite_images_y2026 PARTITION OF satellite_images FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');")
    op.execute("CREATE TABLE satellite_images_y2027 PARTITION OF satellite_images FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');")
    op.execute("CREATE TABLE satellite_images_default PARTITION OF satellite_images DEFAULT;")
    
    op.create_index('idx_sat_img_date', 'satellite_images', ['acquisition_date'])

    # 5. Create partitioned feature_vectors table
    op.execute("""
        CREATE TABLE feature_vectors (
            id SERIAL,
            farm_id INTEGER NOT NULL REFERENCES farms(id),
            date DATE NOT NULL,
            ndvi DOUBLE PRECISION,
            ndwi DOUBLE PRECISION,
            evi DOUBLE PRECISION,
            savi DOUBLE PRECISION,
            gndvi DOUBLE PRECISION,
            ndre DOUBLE PRECISION,
            msi DOUBLE PRECISION,
            ndbi DOUBLE PRECISION,
            nbr DOUBLE PRECISION,
            gci DOUBLE PRECISION,
            ndvi_trend DOUBLE PRECISION,
            rainfall_anomaly DOUBLE PRECISION,
            temperature_stress DOUBLE PRECISION,
            is_valid BOOLEAN NOT NULL DEFAULT TRUE,
            outlier_flags JSONB,
            PRIMARY KEY (farm_id, date)
        ) PARTITION BY RANGE (date);
    """)
    op.execute("CREATE TABLE feature_vectors_y2024 PARTITION OF feature_vectors FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');")
    op.execute("CREATE TABLE feature_vectors_y2025 PARTITION OF feature_vectors FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');")
    op.execute("CREATE TABLE feature_vectors_y2026 PARTITION OF feature_vectors FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');")
    op.execute("CREATE TABLE feature_vectors_y2027 PARTITION OF feature_vectors FOR VALUES FROM ('2027-01-01') TO ('2028-01-01');")
    op.execute("CREATE TABLE feature_vectors_default PARTITION OF feature_vectors DEFAULT;")
    
    op.create_index('idx_feat_vec_date', 'feature_vectors', ['date'])

    # 6. Create data_pipeline_runs table
    op.create_table(
        'data_pipeline_runs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('farm_id', sa.Integer(), nullable=False),
        sa.Column('run_type', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False, server_default='pending'),
        sa.Column('started_at', sa.DateTime(), nullable=False, server_default=sa.text('now()')),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('duration_ms', sa.Integer(), nullable=True),
        sa.Column('tasks_completed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('tasks_failed', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('error_log', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['farm_id'], ['farms.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_pipeline_run_farm', 'data_pipeline_runs', ['farm_id'])
    op.create_index('idx_pipeline_run_status', 'data_pipeline_runs', ['status'])

def downgrade() -> None:
    op.drop_table('data_pipeline_runs')
    op.execute("DROP TABLE IF EXISTS feature_vectors_y2024;")
    op.execute("DROP TABLE IF EXISTS feature_vectors_y2025;")
    op.execute("DROP TABLE IF EXISTS feature_vectors_y2026;")
    op.execute("DROP TABLE IF EXISTS feature_vectors_y2027;")
    op.execute("DROP TABLE IF EXISTS feature_vectors_default;")
    op.execute("DROP TABLE IF EXISTS feature_vectors;")
    op.execute("DROP TABLE IF EXISTS satellite_images_y2024;")
    op.execute("DROP TABLE IF EXISTS satellite_images_y2025;")
    op.execute("DROP TABLE IF EXISTS satellite_images_y2026;")
    op.execute("DROP TABLE IF EXISTS satellite_images_y2027;")
    op.execute("DROP TABLE IF EXISTS satellite_images_default;")
    op.execute("DROP TABLE IF EXISTS satellite_images;")
    op.drop_table('farms')
    op.drop_table('users')
