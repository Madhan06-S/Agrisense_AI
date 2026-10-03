export type TrafficLightColor = "green" | "yellow" | "red";

export interface TrafficLightConfig {
  color: TrafficLightColor;
  label: string;
  badgeClass: string;
  dotClass: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
  meaning: string;
  action: string;
  verdict: string;
  payoutStatus: string;
}

export const TRAFFIC_LIGHTS: Record<TrafficLightColor, TrafficLightConfig> = {
  green: {
    color: "green",
    label: "Green",
    badgeClass: "bg-emerald-50 text-[#166534] border-emerald-300",
    dotClass: "bg-emerald-600",
    borderClass: "border-emerald-200",
    bgClass: "bg-emerald-50/60",
    textClass: "text-[#166534]",
    meaning: "Healthy crop, NDVI normal",
    action: "Claim closed automatically, no payout",
    verdict: "GREEN — HEALTHY CROP (CLAIM AUTO-CLOSED)",
    payoutStatus: "Claim closed (no loss / no payout)"
  },
  yellow: {
    color: "yellow",
    label: "Yellow",
    badgeClass: "bg-amber-50 text-amber-900 border-amber-300",
    dotClass: "bg-amber-500",
    borderClass: "border-amber-200",
    bgClass: "bg-amber-50/60",
    textClass: "text-amber-900",
    meaning: "Inconclusive satellite imagery / moderate anomaly",
    action: "Field officer dispatched with GPS",
    verdict: "YELLOW — FIELD OFFICER DISPATCHED WITH GPS",
    payoutStatus: "Field visit required before settlement"
  },
  red: {
    color: "red",
    label: "Red",
    badgeClass: "bg-red-50 text-red-900 border-red-300",
    dotClass: "bg-red-600",
    borderClass: "border-red-200",
    bgClass: "bg-red-50/60",
    textClass: "text-red-900",
    meaning: "Severe crop damage / drought or flood threshold breach",
    action: "Payout auto-approved and dispatched in 48 hours",
    verdict: "RED — SEVERE DAMAGE (PAYOUT AUTO-APPROVED)",
    payoutStatus: "Dispatched (48 hrs via Aadhaar DBT)"
  }
};
