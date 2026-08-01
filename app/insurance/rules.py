import os
import yaml
import logging
from typing import Dict, Any, List, Tuple, Optional

logger = logging.getLogger(__name__)

# Paths
RULE_DIR = os.path.dirname(os.path.abspath(__file__))
# Defer to config path in workspace root
WORKSPACE_ROOT = os.path.dirname(os.path.dirname(RULE_DIR))
DEFAULT_YAML_PATH = os.path.join(WORKSPACE_ROOT, "config", "insurance_rules.yaml")

# Crop Configurations
CROP_FACTORS = {
    "Rice": {"factor": 1.0, "flood_sensitive": True, "drought_sensitive": False},
    "Wheat": {"factor": 0.9, "drought_sensitive": True, "flood_sensitive": False},
    "Cotton": {"factor": 1.2, "pest_sensitive": True, "drought_sensitive": False},
    "Sugarcane": {"factor": 1.1, "flood_sensitive": True, "drought_sensitive": False},
    "Maize": {"factor": 0.8, "drought_sensitive": True, "flood_sensitive": False}
}

class RuleEngine:
    def __init__(self, yaml_path: str = DEFAULT_YAML_PATH, version: str = "v2026"):
        self.yaml_path = yaml_path
        self.version = version
        self.rules = self.load_rules()
        
    def load_rules(self) -> List[Dict[str, Any]]:
        """Loads rules from YAML configuration."""
        if os.path.exists(self.yaml_path):
            try:
                with open(self.yaml_path, "r") as f:
                    config = yaml.safe_load(f)
                    return config.get("rules", [])
            except Exception as e:
                logger.error("Failed to load YAML rules config: %s. Using default memory config.", e)
        else:
            logger.warning("Rules YAML config file not found at %s. Initializing defaults.", self.yaml_path)
            
        # Default fallback rules
        return [
            {
                "name": "NDVI Drop Payout",
                "condition": "ndvi_drop_percent > 40",
                "threshold": 40.0,
                "payout_type": "percentage_of_sum_insured",
                "payout_value": 0.5,
                "max_payout": 100000.0
            },
            {
                "name": "Flood Index Payout",
                "condition": "flood_index > 0.8",
                "threshold": 0.8,
                "payout_type": "fixed_per_hectare",
                "payout_value": 15000.0,
                "max_payout": 200000.0
            },
            {
                "name": "Rainfall Deficit",
                "condition": "rainfall_anomaly < -60",
                "threshold": -60.0,
                "payout_type": "tiered",
                "tiers": [
                    {"threshold": -60.0, "payout_percent": 0.25},
                    {"threshold": -80.0, "payout_percent": 0.50},
                    {"threshold": -95.0, "payout_percent": 0.75}
                ],
                "max_payout": 150000.0
            }
        ]

    def evaluate(
        self,
        features: Dict[str, float],
        sum_insured: float = 100000.0,
        area_hectares: float = 2.5,
        crop_type: str = "Rice",
        season: str = "Kharif"
    ) -> Dict[str, Any]:
        """
        Evaluates features (ndvi_drop_percent, flood_index, rainfall_anomaly)
        against the rules, applying crop sensitivities and seasonal adjustments.
        """
        triggered = []
        payouts = []
        
        ndvi_drop = features.get("ndvi_drop_percent", 0.0)
        flood = features.get("flood_index", 0.0)
        rain_anomaly = features.get("rainfall_anomaly", 0.0)
        
        crop_conf = CROP_FACTORS.get(crop_type, {"factor": 1.0, "flood_sensitive": False, "drought_sensitive": False})
        crop_factor = crop_conf["factor"]
        
        for rule in self.rules:
            name = rule["name"]
            cond = rule["condition"]
            rule_triggered = False
            calculated_payout = 0.0
            
            # Simple expression parser for condition logic
            if "ndvi_drop_percent > 40" in cond:
                if ndvi_drop > rule.get("threshold", 40.0):
                    rule_triggered = True
            elif "flood_index > 0.8" in cond:
                if flood > rule.get("threshold", 0.8):
                    rule_triggered = True
            elif "rainfall_anomaly < -60" in cond:
                if rain_anomaly < rule.get("threshold", -60.0):
                    rule_triggered = True
                    
            if rule_triggered:
                # Calculate Payout based on rule type
                p_type = rule.get("payout_type", "percentage_of_sum_insured")
                p_val = rule.get("payout_value", 0.0)
                max_p = rule.get("max_payout", 100000.0)
                
                if p_type == "percentage_of_sum_insured":
                    calculated_payout = sum_insured * p_val
                elif p_type == "fixed_per_hectare":
                    calculated_payout = area_hectares * p_val
                elif p_type == "tiered":
                    # Check tiers
                    payout_pct = 0.0
                    for tier in rule.get("tiers", []):
                        # Rainfall deficit check (lower is worse, e.g. -70 < -60)
                        if rain_anomaly <= tier["threshold"]:
                            payout_pct = max(payout_pct, tier["payout_percent"])
                    calculated_payout = sum_insured * payout_pct
                    
                # Apply Crop Sensitivity adjustments
                # If flood sensitive crop and rule is flood-based, boost payout by 1.15
                if "Flood" in name and crop_conf.get("flood_sensitive", False):
                    calculated_payout *= 1.15
                # If drought sensitive crop and rule is rain deficit-based, boost by 1.15
                if "Rainfall" in name and crop_conf.get("drought_sensitive", False):
                    calculated_payout *= 1.15
                    
                # Apply Seasonal Adjustments
                # Kharif (Jun-Oct): flood rules weighted higher (boost by 1.25)
                if season == "Kharif" and "Flood" in name:
                    calculated_payout *= 1.25
                # Rabi (Nov-Apr): drought rules weighted higher (boost by 1.25)
                elif season == "Rabi" and "Rainfall" in name:
                    calculated_payout *= 1.25
                # Zaid (Apr-Jun): NDVI drops weighted higher (boost by 1.25)
                elif season == "Zaid" and "NDVI" in name:
                    calculated_payout *= 1.25
                    
                # Apply overall crop base factor
                calculated_payout *= crop_factor
                
                # Cap at rule max payout and sum insured
                calculated_payout = min(calculated_payout, max_p, sum_insured)
                calculated_payout = max(0.0, calculated_payout)
                
                triggered.append({
                    "rule_name": name,
                    "condition_met": cond,
                    "raw_calculated_payout": calculated_payout
                })
                payouts.append(calculated_payout)
                
        # Total Payout = maximum payout of any triggered rule (non-additive standard) OR sum them?
        # Standard parametric is often non-additive (pays the highest matching trigger)
        total_payout = max(payouts) if payouts else 0.0
        
        # Calculate evaluation confidence
        confidence = 0.95 if triggered else 0.85
        
        return {
            "triggered_rules": triggered,
            "payout_amount": float(total_payout),
            "confidence": float(confidence),
            "rule_version": self.version,
            "crop_multiplier": crop_factor,
            "season": season
        }
