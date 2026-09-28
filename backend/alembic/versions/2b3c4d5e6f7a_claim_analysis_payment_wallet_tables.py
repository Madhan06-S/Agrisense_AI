"""Claim analysis, recommended payout, payment and wallet tables

Revision ID: 2b3c4d5e6f7a
Revises: 1a2b3c4d5e6f
Create Date: 2026-09-28

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '2b3c4d5e6f7a'
down_revision = '1a2b3c4d5e6f'
branch_labels = None
depends_on = None

def upgrade() -> None:
    # 1. Add claim analysis and recommendation columns
    op.add_column('claims', sa.Column('analysis_status', sa.String(length=20), server_default='pending', nullable=True))
    op.add_column('claims', sa.Column('analysis_error_reason', sa.Text(), nullable=True))
    op.add_column('claims', sa.Column('recommended_payout_amount', sa.Float(), nullable=True))

    # 2. Create payments table
    op.create_table(
        'payments',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('payment_id', sa.String(length=100), nullable=False),
        sa.Column('claim_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('beneficiary', sa.String(length=255), nullable=False),
        sa.Column('encrypted_details', sa.Text(), nullable=True),
        sa.Column('digital_signature', sa.String(length=255), nullable=True),
        sa.Column('payment_mode', sa.String(length=50), server_default='UPI', nullable=True),
        sa.Column('status', sa.String(length=50), server_default='initiated', nullable=True),
        sa.Column('idempotency_key', sa.String(length=255), nullable=True),
        sa.Column('retry_attempts', sa.Integer(), server_default='0', nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['claim_id'], ['claims.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('payment_id'),
        sa.UniqueConstraint('idempotency_key')
    )
    op.create_index('idx_payments_payment_id', 'payments', ['payment_id'])
    op.create_index('idx_payments_status', 'payments', ['status'])

    # 3. Create wallets table
    op.create_table(
        'wallets',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('farmer_id', sa.Integer(), nullable=False),
        sa.Column('balance_inr', sa.Float(), server_default='0.0', nullable=False),
        sa.Column('status', sa.String(length=50), server_default='ACTIVE', nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['farmer_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('farmer_id')
    )

    # 4. Create wallet_transactions table
    op.create_table(
        'wallet_transactions',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('transaction_id', sa.String(length=100), nullable=False),
        sa.Column('farmer_id', sa.Integer(), nullable=False),
        sa.Column('amount', sa.Float(), nullable=False),
        sa.Column('type', sa.String(length=20), nullable=False),
        sa.Column('description', sa.String(length=255), nullable=True),
        sa.Column('timestamp', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['farmer_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('transaction_id')
    )
    op.create_index('idx_wallet_txns_txn_id', 'wallet_transactions', ['transaction_id'])

def downgrade() -> None:
    op.drop_index('idx_wallet_txns_txn_id', table_name='wallet_transactions')
    op.drop_table('wallet_transactions')
    op.drop_table('wallets')
    op.drop_index('idx_payments_status', table_name='payments')
    op.drop_index('idx_payments_payment_id', table_name='payments')
    op.drop_table('payments')
    op.drop_column('claims', 'recommended_payout_amount')
    op.drop_column('claims', 'analysis_error_reason')
    op.drop_column('claims', 'analysis_status')
