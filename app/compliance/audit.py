import time
import json
import hashlib
import logging
from typing import Dict, Any, List, Optional

logger = logging.getLogger(__name__)

class AuditBlock:
    def __init__(self, index: int, action: str, details: Dict[str, Any], preceding_hash: str):
        self.index = index
        self.timestamp = time.time()
        self.action = action
        self.details = details
        self.preceding_hash = preceding_hash
        self.hash = self.calculate_hash()
        
    def calculate_hash(self) -> str:
        """Computes SHA-256 signature for this transaction log."""
        data_block = {
            "index": self.index,
            "timestamp": self.timestamp,
            "action": self.action,
            "details": self.details,
            "preceding_hash": self.preceding_hash
        }
        serialized = json.dumps(data_block, sort_keys=True)
        return hashlib.sha256(serialized.encode()).hexdigest()

class ImmutableAuditLog:
    def __init__(self):
        self.chain: List[AuditBlock] = []
        self.create_genesis_block()
        
    def create_genesis_block(self):
        """Creates the starting anchor block in the chain."""
        genesis = AuditBlock(0, "GENESIS", {"desc": "AgriSense Compliance Chain Established"}, "0")
        self.chain.append(genesis)
        
    def get_latest_block(self) -> AuditBlock:
        return self.chain[-1]
        
    def append_log(self, action: str, details: Dict[str, Any]) -> AuditBlock:
        """Appends a new verified event block to the ledger."""
        latest = self.get_latest_block()
        new_block = AuditBlock(
            index=latest.index + 1,
            action=action,
            details=details,
            preceding_hash=latest.hash
        )
        self.chain.append(new_block)
        logger.info("New audit block added: %d - %s, Hash: %s", new_block.index, action, new_block.hash[:10])
        return new_block
        
    def validate_chain(self) -> bool:
        """Verifies that no block has been altered/tempered with."""
        for i in range(1, len(self.chain)):
            current = self.chain[i]
            previous = self.chain[i - 1]
            
            # Recalculate hash of current block
            if current.hash != current.calculate_hash():
                logger.error("Audit log validation failed: Block %d hash mismatch", current.index)
                return False
                
            # Verify linkage to preceding block
            if current.preceding_hash != previous.hash:
                logger.error("Audit log validation failed: Block %d parent hash mismatch", current.index)
                return False
                
        return True

# Initialize single global compliance chain
COMPLIANCE_AUDIT_LOG = ImmutableAuditLog()
