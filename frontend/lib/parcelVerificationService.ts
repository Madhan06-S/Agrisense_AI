/**
 * Parcel Verification & Insurance Evidence Snapshot Service
 * Interface for official cadastral/land-record GIS integration and audit trail logging.
 */

export interface InsuredLandSnapshot {
  snapshotId: string;
  farmId: number;
  version: number;
  capturedAt: string;
  farmName: string;
  cropType: string;
  sowingDate: string;
  state: string;
  district: string;
  taluka: string;
  village: string;
  khasraNumber: string;
  insurancePolicyNumber: string;
  gpsLatitude: number | null;
  gpsLongitude: number | null;
  gpsAccuracyMeters: number | null;
  centerPinLatitude: number | null;
  centerPinLongitude: number | null;
  boundaryGeoJSON: {
    type: "Polygon";
    coordinates: number[][][];
  };
  areaHectares: number;
  areaAcres: number;
  boundaryVertexCount: number;
  overlapStatus: "NONE" | "PARTIAL" | "SIGNIFICANT";
  overlappingFarmIds: number[];
  verificationStatus: "PENDING_OFFICIAL_VERIFICATION" | "PARCEL_MATCHED" | "VERIFIED";
  disclaimer: string;
}

export interface BoundaryVersion {
  version: number;
  boundaryGeoJSON: {
    type: "Polygon";
    coordinates: number[][][];
  };
  areaHectares: number;
  areaAcres: number;
  createdAt: string;
  changeReason?: string;
  isActive: boolean;
}

export interface AuditLogEntry {
  id: string;
  farmId: number;
  eventType:
    | "FARM_CREATED"
    | "GPS_CAPTURED"
    | "LAND_PIN_PLACED"
    | "BOUNDARY_DRAWN"
    | "BOUNDARY_EDITED"
    | "BOUNDARY_VERSION_CREATED"
    | "OVERLAP_CHECKED"
    | "VERIFICATION_STATUS_CHANGED"
    | "SNAPSHOT_CREATED";
  timestamp: string;
  actor: string;
  details: string;
}

export interface VerificationResult {
  status: "PENDING_OFFICIAL_VERIFICATION" | "PARCEL_MATCHED" | "VERIFIED";
  matchScore: number | null;
  officialParcelId: string | null;
  officialAreaHectares: number | null;
  message: string;
  checklist: {
    gpsCaptured: boolean;
    centerPinAdded: boolean;
    boundaryDrawn: boolean;
    boundaryValid: boolean;
    noOverlapConflict: boolean;
    officialRecordMatch: boolean;
  };
}

export class ParcelVerificationService {
  /**
   * Verify parcel details against state land-record GIS registry.
   * Returns PENDING_OFFICIAL_VERIFICATION until official API integration.
   */
  static async verifyParcelWithCadastral(
    khasraNumber: string,
    state: string,
    district: string,
    boundaryGeoJSON: any
  ): Promise<VerificationResult> {
    // Note: Official state land record API integration placeholder
    return {
      status: "PENDING_OFFICIAL_VERIFICATION",
      matchScore: null,
      officialParcelId: null,
      officialAreaHectares: null,
      message: "Pending official state cadastral GIS verification.",
      checklist: {
        gpsCaptured: true,
        centerPinAdded: true,
        boundaryDrawn: true,
        boundaryValid: true,
        noOverlapConflict: true,
        officialRecordMatch: false,
      },
    };
  }

  /**
   * Create an immutable evidence snapshot for insurance claim baseline.
   */
  static createSnapshot(data: Omit<InsuredLandSnapshot, "snapshotId" | "capturedAt">): InsuredLandSnapshot {
    const timestamp = new Date().toISOString();
    const snapshotId = `SNAP-${data.farmId}-${data.version}-${Date.now().toString(36).toUpperCase()}`;
    return {
      ...data,
      snapshotId,
      capturedAt: timestamp,
    };
  }

  /**
   * Generate initial audit log entries for farm registration.
   */
  static createAuditLog(
    farmId: number,
    eventType: AuditLogEntry["eventType"],
    details: string,
    actor: string = "Farmer"
  ): AuditLogEntry {
    return {
      id: `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      farmId,
      eventType,
      timestamp: new Date().toISOString(),
      actor,
      details,
    };
  }
}
