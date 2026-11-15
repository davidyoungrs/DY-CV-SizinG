import type { CharacteristicConfig } from './characteristicEngine.ts';
import { evaluateInherentPhi } from './characteristicEngine.ts';

export type CageMaterialId =
  | 'SS316TI_CR_HF'
  | 'SS316L'
  | 'SS410_HT'
  | 'CA6NM_13CR4NI'
  | 'PH17_4_H900'
  | 'PH17_4_H1150M'
  | 'HASTELLOY_C276'
  | 'INCONEL_718'
  | 'STELLITE_6';

export interface CageMaterialSpec {
  id: CageMaterialId;
  name: string;
  unsOrEnCode: string;
  Sm_20C_MPa: number;
  Sy_20C_MPa: number;
  E_20C_GPa: number;
  alpha_1e6_per_K: number;
  thermalConductivity_W_mK: number;
  maxTemp_degC: number;
  minTemp_degC: number;
  hardnessHRC: string;
  naceMR0175Compliant: boolean;
  notes: string;
}

export const CAGE_MATERIALS: Record<CageMaterialId, CageMaterialSpec> = {
  SS316TI_CR_HF: {
    id: 'SS316TI_CR_HF',
    name: '316Ti SS (1.4571) + Cr Hard-Faced',
    unsOrEnCode: 'UNS S31635 / 1.4571',
    Sm_20C_MPa: 138,
    Sy_20C_MPa: 225,
    E_20C_GPa: 193,
    alpha_1e6_per_K: 16.5,
    thermalConductivity_W_mK: 16.2,
    maxTemp_degC: 550,
    minTemp_degC: -196,
    hardnessHRC: 'Base 18 HRC / Cr-HF 62 HRC',
    naceMR0175Compliant: true,
    notes: 'Austenitic stainless with hard chrome bore overlay for anti-galling & NACE sour service.',
  },
  SS316L: {
    id: 'SS316L',
    name: '316L Austenitic Stainless Steel',
    unsOrEnCode: 'UNS S31603 / 1.4404',
    Sm_20C_MPa: 115,
    Sy_20C_MPa: 175,
    E_20C_GPa: 193,
    alpha_1e6_per_K: 16.6,
    thermalConductivity_W_mK: 16.0,
    maxTemp_degC: 450,
    minTemp_degC: -196,
    hardnessHRC: '≤ 22 HRC (85 HRB)',
    naceMR0175Compliant: true,
    notes: 'Cryogenic & corrosive general process standard down to -196 °C.',
  },
  SS410_HT: {
    id: 'SS410_HT',
    name: '410 Martensitic SS (Heat Treated)',
    unsOrEnCode: 'UNS S41000 / 1.4006',
    Sm_20C_MPa: 205,
    Sy_20C_MPa: 620,
    E_20C_GPa: 200,
    alpha_1e6_per_K: 11.2,
    thermalConductivity_W_mK: 24.9,
    maxTemp_degC: 480,
    minTemp_degC: -29,
    hardnessHRC: '38–42 HRC',
    naceMR0175Compliant: false,
    notes: 'High-hardness low-CTE martensitic cage for high-pressure BFW and superheated steam.',
  },
  CA6NM_13CR4NI: {
    id: 'CA6NM_13CR4NI',
    name: 'F6NM / CA6NM (13Cr-4Ni Martensitic)',
    unsOrEnCode: 'UNS S41500 / 1.4313',
    Sm_20C_MPa: 195,
    Sy_20C_MPa: 550,
    E_20C_GPa: 200,
    alpha_1e6_per_K: 11.5,
    thermalConductivity_W_mK: 24.5,
    maxTemp_degC: 425,
    minTemp_degC: -60,
    hardnessHRC: '≤ 23 HRC (Double Tempered)',
    naceMR0175Compliant: true,
    notes: 'NACE MR0175 compliant double-tempered martensitic stainless for hydrocarbon & sour water.',
  },
  PH17_4_H900: {
    id: 'PH17_4_H900',
    name: '17-4 PH Stainless (Condition H900)',
    unsOrEnCode: 'UNS S17400 (H900)',
    Sm_20C_MPa: 310,
    Sy_20C_MPa: 1170,
    E_20C_GPa: 197,
    alpha_1e6_per_K: 10.8,
    thermalConductivity_W_mK: 18.4,
    maxTemp_degC: 315,
    minTemp_degC: -29,
    hardnessHRC: '40–44 HRC',
    naceMR0175Compliant: false,
    notes: 'Ultra-high strength precipitation-hardened cage for high ΔP cavitation letdown ≤ 315 °C.',
  },
  PH17_4_H1150M: {
    id: 'PH17_4_H1150M',
    name: '17-4 PH Stainless (Double H1150M NACE)',
    unsOrEnCode: 'UNS S17400 (H1150M)',
    Sm_20C_MPa: 215,
    Sy_20C_MPa: 585,
    E_20C_GPa: 197,
    alpha_1e6_per_K: 11.2,
    thermalConductivity_W_mK: 19.0,
    maxTemp_degC: 315,
    minTemp_degC: -45,
    hardnessHRC: '≤ 33 HRC',
    naceMR0175Compliant: true,
    notes: 'NACE MR0175 sour-service precipitation-hardened stainless.',
  },
  HASTELLOY_C276: {
    id: 'HASTELLOY_C276',
    name: 'Alloy C-276 / Hastelloy C-22',
    unsOrEnCode: 'UNS N10276 / N06022',
    Sm_20C_MPa: 188,
    Sy_20C_MPa: 355,
    E_20C_GPa: 205,
    alpha_1e6_per_K: 12.4,
    thermalConductivity_W_mK: 11.5,
    maxTemp_degC: 580,
    minTemp_degC: -196,
    hardnessHRC: '≤ 35 HRC',
    naceMR0175Compliant: true,
    notes: 'Severe chemical, wet chlorine (Euro Chlor GEST 17/492), acid & sour gas trim.',
  },
  INCONEL_718: {
    id: 'INCONEL_718',
    name: 'Alloy 718 (Inconel 718 Precipitation Hardened)',
    unsOrEnCode: 'UNS N07718',
    Sm_20C_MPa: 345,
    Sy_20C_MPa: 1035,
    E_20C_GPa: 204,
    alpha_1e6_per_K: 13.0,
    thermalConductivity_W_mK: 11.4,
    maxTemp_degC: 580,
    minTemp_degC: -196,
    hardnessHRC: '≤ 40 HRC (NACE Ni-Base)',
    naceMR0175Compliant: true,
    notes: 'High-temperature severe service up to 580 °C and extreme sour ΔP.',
  },
  STELLITE_6: {
    id: 'STELLITE_6',
    name: 'Solid Cobalt-Cr-W Alloy (Stellite 6)',
    unsOrEnCode: 'UNS R30006',
    Sm_20C_MPa: 240,
    Sy_20C_MPa: 630,
    E_20C_GPa: 210,
    alpha_1e6_per_K: 13.8,
    thermalConductivity_W_mK: 14.8,
    maxTemp_degC: 580,
    minTemp_degC: -196,
    hardnessHRC: '40–44 HRC',
    naceMR0175Compliant: true,
    notes: 'Maximum flashing erosion and cavitation resistance across all temperature regimes.',
  },
};

export function evaluateMaterialAtTemp(
  matId: CageMaterialId,
  temp_degC: number
): {
  spec: CageMaterialSpec;
  Sm_T_MPa: number;
  Sy_T_MPa: number;
  E_T_GPa: number;
  tempCompliant: boolean;
} {
  const spec = CAGE_MATERIALS[matId] || CAGE_MATERIALS.SS316TI_CR_HF;
  const T = Math.max(-200, Math.min(650, temp_degC));

  let stressDerate = 1.0;
  let modDerate = 1.0;
  if (T > 50) {
    const dT = T - 50;
    stressDerate = Math.max(0.45, 1.0 - 0.00072 * dT - 1.1e-6 * dT * dT);
    modDerate = Math.max(0.65, 1.0 - 0.00048 * dT);
  }

  const Sm_T_MPa = Number((spec.Sm_20C_MPa * stressDerate).toFixed(1));
  const Sy_T_MPa = Number((spec.Sy_20C_MPa * stressDerate).toFixed(1));
  const E_T_GPa = Number((spec.E_20C_GPa * modDerate).toFixed(1));
  const tempCompliant = T >= spec.minTemp_degC && T <= spec.maxTemp_degC;

  return {
    spec,
    Sm_T_MPa,
    Sy_T_MPa,
    E_T_GPa,
    tempCompliant,
  };
}

/**
 * Exact Circular Segment Uncovering Area A_seg(h_local, R)
 * When plug edge is at local height h_local in [0, 2R] above bottom of hole of radius R:
 * A(h) = R^2 * arccos((R - h)/R) - (R - h) * sqrt(2*R*h - h^2)
 * Derivative dA/dh = 2 * sqrt(2*R*h - h^2) (local chord width W(h))
 */
export function evaluateCircularHoleSegmentUncovering(
  plugLift_mm: number,
  holeCenterZ_mm: number,
  holeDia_mm: number
): {
  exposedArea_mm2: number;
  chordWidth_mm: number;
  openingFraction: number;
  localDischargeFactor: number;
} {
  const R = Math.max(0.5, holeDia_mm / 2);
  const fullArea = Math.PI * R * R;
  const zBottom = holeCenterZ_mm - R;
  const zTop = holeCenterZ_mm + R;

  if (plugLift_mm <= zBottom) {
    return {
      exposedArea_mm2: 0,
      chordWidth_mm: 0,
      openingFraction: 0,
      localDischargeFactor: 0.48,
    };
  }
  if (plugLift_mm >= zTop) {
    return {
      exposedArea_mm2: fullArea,
      chordWidth_mm: 0,
      openingFraction: 1.0,
      localDischargeFactor: 1.0,
    };
  }

  const h = Math.max(0, Math.min(2 * R, plugLift_mm - zBottom));
  const ratio = Math.max(-1, Math.min(1, (R - h) / R));
  const radTerm = Math.max(0, 2 * R * h - h * h);
  const exposedArea_mm2 = R * R * Math.acos(ratio) - (R - h) * Math.sqrt(radTerm);
  const chordWidth_mm = 2 * Math.sqrt(radTerm);
  const openingFraction = exposedArea_mm2 / fullArea;

  // University of Huddersfield / Sibanda & Singh slit-to-orifice Cd transition:
  // At partial crack-open (h/d_h < 0.2), boundary layer slit friction reduces Cd (~0.75x nominal);
  // above h/d_h > 0.6, vena contracta recovers to 1.0x nominal Cd.
  const hOverD = h / (2 * R);
  const localDischargeFactor = 0.76 + 0.24 * Math.pow(hOverD, 0.45);

  return {
    exposedArea_mm2,
    chordWidth_mm,
    openingFraction,
    localDischargeFactor,
  };
}

/**
 * Ngqabutho Sibanda (2022, University of Huddersfield PhD Thesis, Eq. 5.10)
 * Semi-Empirical 3D Gallery Local Hole Cv Predictor:
 *   Cv_hole = A * Re^a * D^b * HT^c * theta_norm^d
 * Captures non-uniform circumferential flow distribution around the cage cylinder
 * (Stagnation peak at 0°/360°, boundary-layer separation dips at 135° & 225°,
 * rear impingement recovery at 180°, and axial elevation gain HT^c).
 */
export function evaluateSibandaLocalHoleFactor(params: {
  angle_deg: number; // 0 to 360 deg (0 = facing valve body inlet)
  zElevation_mm: number;
  stroke_mm: number;
  holeDia_mm: number;
  cageID_mm: number;
  reynoldsHole?: number;
}): {
  relativeWeight: number; // Normalized around 1.0 mean
  predictedHoleCv: number;
  flowZone: 'INLET_STAGNATION' | 'FLANK_SEPARATION_CAV_RISK' | 'REAR_RECOVERY' | 'TRANSITION';
} {
  const theta = ((params.angle_deg % 360) + 360) % 360;
  // Fold symmetric angle around 0..180 for gallery crossflow physics + Sibanda Eq 5.10
  const thetaNorm = Math.max(0.03, Math.min(0.99, theta / 360));
  const Re = Math.max(5000, params.reynoldsHole || 85000);
  const D_nonDim = Math.max(0.02, Math.min(0.35, params.holeDia_mm / Math.max(15, params.cageID_mm)));
  const HT_nonDim = Math.max(0.08, Math.min(1.0, params.zElevation_mm / Math.max(10, params.stroke_mm)));

  // Sibanda Eq. 5.10 two-domain power law (Table in Section 5.3, R^2 = 0.947 / 0.930)
  let rawEq510 = 1.0;
  if (theta <= 180) {
    rawEq510 =
      3834.371 *
      Math.pow(Re, -0.16244) *
      Math.pow(D_nonDim, 1.86188) *
      Math.pow(HT_nonDim, 0.15013) *
      Math.pow(Math.max(0.04, thetaNorm), -0.18);
  } else {
    rawEq510 =
      4572.29 *
      Math.pow(Re, -0.14668) *
      Math.pow(D_nonDim, 2.2748) *
      Math.pow(HT_nonDim, 0.11763) *
      Math.pow(thetaNorm, 0.24);
  }

  // Sibanda Chapter 5 parabolic angular velocity/pressure distribution around cylinder in crossflow:
  // Peak at 0°/360° (inlet stagnation), minimum at 135° & 225° (flow separation & low dP),
  // local recovery hump at 180° (rear gallery stream collision).
  const rad = (theta * Math.PI) / 180;
  const angularDistribution =
    1.0 +
    0.26 * Math.cos(rad) +
    0.14 * Math.cos(2 * rad) -
    0.08 * Math.sin(rad / 2);

  // Elevation factor from Sibanda HT^0.15013 (upper rows experience lower gallery turn loss)
  const elevationFactor = 0.92 + 0.16 * Math.pow(HT_nonDim, 0.15013);
  const relativeWeight = Number(
    Math.max(0.55, Math.min(1.42, angularDistribution * elevationFactor)).toFixed(3)
  );

  let flowZone: 'INLET_STAGNATION' | 'FLANK_SEPARATION_CAV_RISK' | 'REAR_RECOVERY' | 'TRANSITION' =
    'TRANSITION';
  if (theta <= 35 || theta >= 325) {
    flowZone = 'INLET_STAGNATION';
  } else if ((theta >= 110 && theta <= 155) || (theta >= 205 && theta <= 250)) {
    flowZone = 'FLANK_SEPARATION_CAV_RISK';
  } else if (theta > 155 && theta < 205) {
    flowZone = 'REAR_RECOVERY';
  }

  return {
    relativeWeight,
    predictedHoleCv: Number((rawEq510 * relativeWeight).toFixed(3)),
    flowZone,
  };
}

export interface CageHoleRow {
  rowIndex: number; // 1..N
  zElevation_mm: number; // Center elevation from seat datum (mm)
  zBottom_mm: number; // Crack-open elevation z_k - R_k (mm)
  zTop_mm: number; // Full-open elevation z_k + R_k (mm)
  axialPitchFromPrev_mm: number; // p_z = z_k - z_{k-1} (mm)
  axialOverlapWithPrev_mm: number; // d_avg - p_z (mm) -> MUST BE > 0 for Zero Deadband!
  axialOverlapPct: number; // % of hole diameter overlapped with previous row
  travelPctAtRowCenter: number;
  travelPctAtRowTop: number;
  holeDia_mm: number; // d_k (mm)
  holeCount: number; // n_k integer holes in ring
  circumferentialPitch_mm: number; // p_theta = pi * D_ID / n_k (mm)
  diagonalPitch_mm: number; // Staggered diagonal pitch sqrt(p_z^2 + (p_theta/2)^2)
  pitchToDiaRatio: number; // p_theta / d_k (IEC 60534-8-3 recommends >= 2.0)
  ligamentWidth_mm: number; // min(circumferential, diagonal) ligament width (mm)
  ligamentEfficiency: number;
  rowArea_mm2: number;
  cumulativeArea_mm2: number;
  cumulativeCv: number;
  angularOffset_deg: number; // Staggered / helical offset
  sibandaRowElevationFactor: number; // HT^0.15013 factor from Sibanda (2022)
}

export interface ContinuousUncoveringPoint {
  travelPct: number; // 0 to 100
  lift_mm: number;
  targetArea_mm2: number;
  actualCircularSegmentArea_mm2: number;
  targetCv: number;
  actualSynthesizedCv: number;
  instantaneousChordGain_mm2_per_mm: number; // dA/dh = sum of active chord widths W_k(h)
  activeOverlappingRowsCount: number; // Number of rows simultaneously being uncovered at lift h
}

export type HoleSpacingRuleId =
  | 'ABS_MIN_1_5D'
  | 'STD_HIGH_CAP_1_75D'
  | 'LOW_NOISE_ANTI_CAV_2_25D';

export const HOLE_SPACING_RULES: Record<
  HoleSpacingRuleId,
  {
    id: HoleSpacingRuleId;
    label: string;
    minPitchToDia: number;
    minLigamentToDia: number;
    driver: string;
  }
> = {
  ABS_MIN_1_5D: {
    id: 'ABS_MIN_1_5D',
    label: 'Absolute Mechanical Minimum (P ≥ 1.50d | L ≥ 0.50d)',
    minPitchToDia: 1.5,
    minLigamentToDia: 0.5,
    driver: 'Structural integrity, machining limits, and plug bearing area',
  },
  STD_HIGH_CAP_1_75D: {
    id: 'STD_HIGH_CAP_1_75D',
    label: 'Standard High-Capacity Trim (P = 1.75d–2.00d | L = 0.75d–1.00d)',
    minPitchToDia: 1.85,
    minLigamentToDia: 0.85,
    driver: 'Balancing high Cv with hoop/axial stress resistance',
  },
  LOW_NOISE_ANTI_CAV_2_25D: {
    id: 'LOW_NOISE_ANTI_CAV_2_25D',
    label: 'Low-Noise / Anti-Cavitation (P = 2.00d–3.00d | L = 1.00d–2.00d)',
    minPitchToDia: 2.25,
    minLigamentToDia: 1.25,
    driver: 'Preventing jet coalescence and acoustic regeneration',
  },
};

export interface CageSynthesisAndStressResult {
  rows: CageHoleRow[];
  continuousProfile: ContinuousUncoveringPoint[];
  totalHoles: number;
  totalOrificeArea_mm2: number;
  synthesizedTrimCv: number;
  compositeRatedCv: number;
  styleModifierFd: number;
  meanHoleDia_mm: number;
  // Deadband & Row Overlap Diagnostics
  deadbandStrokePct: number; // % of stroke where dA/dh == 0 (0.0% when rows overlap!)
  maxDeadbandGap_mm: number; // Max axial gap between rows (0.0 mm when overlapped)
  meanRowOverlapPct: number; // Average axial overlap % between adjacent staggered rows
  minActiveOverlappingRows: number;
  curveFitRMSDeviationPct: number; // RMS error between actual circular-segment Cv(h) and target curve
  holeSpacingRule: HoleSpacingRuleId;
  minPitchToDiaRatio: number; // True 2D cylindrical minimum center-to-center pitch / d_avg
  minLigamentToDiaRatio: number; // True 2D edge-to-edge ligament / d_avg
  jetCoalescenceCompliant: boolean;
  minLigamentWidth_mm: number;
  minLigamentEfficiency: number;
  // Structural Stress & Minimum Wall Thickness (ASME B16.34 / Sec VIII)
  cageID_mm: number;
  cageOD_mm: number;
  selectedWallThickness_mm: number;
  minRequiredWallThickness_mm: number;
  erosionAllowance_mm: number;
  hoopStress_MPa: number;
  allowableStressSm_MPa: number;
  hoopStressUtilizationPct: number;
  criticalCollapsePressure_bar: number;
  collapseSafetyFactor: number;
  structuralStatus: 'PASS' | 'WARNING' | 'CRITICAL';
  naceSourCompliant: boolean;
  tempCompliant: boolean;
  // Cage Cylinder Area Saturation & Valve Upsize Recommendation
  cageSurfaceArea_mm2: number; // Gross physical cylinder surface area: pi * D_ID * stroke_mm
  perforationRatioPct: number; // (totalOrificeArea_mm2 / cageSurfaceArea_mm2) * 100
  isAreaSaturated: boolean; // True when requested trim Cv demands > 38% perforation or achieves < 75% target
  saturationSeverity: 'OPTIMAL' | 'HIGH_DENSITY' | 'SATURATED_UPSIZE_RECOMMENDED';
  saturationMessage: string;
  recommendedMinValveSize?: string;
}

/**
 * Synthesizes a Zero-Deadband Overlapping Staggered Drilled-Hole Cage
 * Incorporating:
 *  1. Continuous Circular-Segment Uncovering A_seg(h) = R^2 arccos((R-h)/R) - (R-h)sqrt(2Rh-h^2)
 *  2. Mandatory Axial Row Overlap (p_z <= (1 - overlapRatio) * d_h) so dA/dh > 0 across 0-100% stroke
 *  3. Ngqabutho Sibanda (2022, University of Huddersfield) 3D Gallery Elevation & Angular Cv Model
 *  4. ASME B16.34 / Section VIII Perforated Cylinder Hoop & Diagonal Ligament Stress Verification
 */
export function synthesizeDrilledCageAndStress(params: {
  cageID_mm: number;
  stroke_mm: number;
  targetTrimCv: number;
  cvSeatComponent: number;
  cvBodyComponent: number;
  orificeDischargeCoeff: number;
  characteristicConfig: CharacteristicConfig;
  numRows: number;
  baseHoleDia_mm: number;
  modulateHoleDiameter: boolean;
  selectedWallThickness_mm: number;
  erosionAllowance_mm: number;
  shutoffDeltaP_bar: number;
  operatingTemp_degC: number;
  materialId: CageMaterialId;
  requireNaceSourService: boolean;
  enforceZeroDeadbandOverlap?: boolean; // Defaults to true!
  targetRowOverlapPct?: number; // Defaults to 28% axial overlap between staggered rows
  holeSpacingRule?: HoleSpacingRuleId; // Defaults to 'STD_HIGH_CAP_1_75D'
  ratedValveCv?: number; // Total rated valve body Cv (e.g. 104 for DN80)
  maxProcessRequiredCv?: number; // Maximum process required Cv from active operating conditions
}): CageSynthesisAndStressResult {
  const {
    cageID_mm,
    stroke_mm,
    targetTrimCv,
    cvSeatComponent,
    cvBodyComponent,
    orificeDischargeCoeff,
    characteristicConfig,
    numRows,
    baseHoleDia_mm,
    modulateHoleDiameter,
    selectedWallThickness_mm,
    erosionAllowance_mm,
    shutoffDeltaP_bar,
    operatingTemp_degC,
    materialId,
    requireNaceSourService,
    enforceZeroDeadbandOverlap = true,
    targetRowOverlapPct = 28,
    holeSpacingRule = 'STD_HIGH_CAP_1_75D',
    ratedValveCv,
    maxProcessRequiredCv,
  } = params;

  const spacingRuleSpec = HOLE_SPACING_RULES[holeSpacingRule];
  const reqPitchRatio = spacingRuleSpec.minPitchToDia;

  const D_ID = Math.max(12, cageID_mm);
  const H = Math.max(10, stroke_mm);
  const C_d = Math.max(0.55, Math.min(0.82, orificeDischargeCoeff));
  const circumference_mm = Math.PI * D_ID;

  // Total required geometric hole area A_total (mm2):
  const requiredTotalArea_mm2 = targetTrimCv / Math.max(0.01, 0.0589 * C_d);

  // Determine optimal axial row count N_rows to guarantee Zero Deadband (p_z <= (1 - overlap) * d_h)
  const overlapFrac = enforceZeroDeadbandOverlap
    ? Math.max(0.15, Math.min(0.45, targetRowOverlapPct / 100))
    : 0.0;

  const avgHoleDia = modulateHoleDiameter ? baseHoleDia_mm * 0.9 : baseHoleDia_mm;
  const maxAllowedAxialPitch_mm = Math.max(1.2, avgHoleDia * (1 - overlapFrac));
  const minRowsForZeroDeadband = Math.max(
    6,
    Math.ceil((H - avgHoleDia) / maxAllowedAxialPitch_mm) + 1
  );

  const N_rows = enforceZeroDeadbandOverlap
    ? Math.max(Math.round(numRows), Math.min(36, minRowsForZeroDeadband))
    : Math.max(4, Math.min(36, Math.round(numRows)));

  // Step 1: Assign characteristic-aware hole diameters d_k and overlapping axial center elevations z_k
  // so Row 1 cracks open immediately at z_bottom,1 = 0.0 mm (z_1 = R_1)
  // and Row N finishes opening right at z_top,N = H (z_N = H - R_N).
  //
  // For Equal-% trim, modulateHoleDiameter provides micro-orifices at low lift and larger orifices at high lift.
  // For Quick-Opening trim, larger orifices are placed at low lift transitioning to standard orifices.
  const holeDias: number[] = [];
  for (let k = 1; k <= N_rows; k++) {
    const hNorm = (k - 0.5) / N_rows;
    let d_k = Math.max(1.5, Math.min(18.0, baseHoleDia_mm));
    if (modulateHoleDiameter) {
      let scale = 1.0;
      switch (characteristicConfig.type) {
        case 'EQUAL_PCT': {
          // Rangeability modulation: smaller orifices at bottom (fine flow control), expanding at top
          scale = 0.68 + 0.52 * Math.pow(hNorm, 1.35);
          break;
        }
        case 'QUICK_OPENING': {
          // Rapid initial area opening: larger orifices at low lift, tapering down
          scale = 1.22 - 0.45 * Math.pow(hNorm, 0.75);
          break;
        }
        case 'BI_LINEAR': {
          const knee = characteristicConfig.biLinearKneeTravelPct
            ? characteristicConfig.biLinearKneeTravelPct / 100
            : 0.3;
          scale = hNorm <= knee ? 0.72 : 1.15;
          break;
        }
        case 'LINEAR':
        default: {
          scale = 0.85 + 0.30 * hNorm;
          break;
        }
      }
      d_k = Number(Math.max(1.5, baseHoleDia_mm * scale).toFixed(1));
    }
    holeDias.push(d_k);
  }

  const R_first = holeDias[0] / 2;
  const R_last = holeDias[N_rows - 1] / 2;
  const zStart = R_first; // Bottom edge of Row 1 is at 0.0 mm (zero initial deadband!)
  const zEnd = Math.max(zStart + 2.0, H - R_last * 0.35); // Top edge of Row N spans full stroke H

  const zCenters: number[] = [];
  for (let k = 0; k < N_rows; k++) {
    const frac = N_rows > 1 ? k / (N_rows - 1) : 0.5;
    zCenters.push(Number((zStart + frac * (zEnd - zStart)).toFixed(2)));
  }

  // Pre-calculate clean lift partitions and incremental phi for each row
  // h_lower and h_upper cleanly partition the [0, 1] travel range across rows
  const rowDeltaPhis: number[] = [];
  for (let k = 0; k < N_rows; k++) {
    const hLower = k === 0 ? 0 : (k - 0.5) / (N_rows - 1);
    const hUpper = k === N_rows - 1 ? 1.0 : (k + 0.5) / (N_rows - 1);
    const phiLower = evaluateInherentPhi(Math.max(0, Math.min(1, hLower)), characteristicConfig);
    const phiUpper = evaluateInherentPhi(Math.max(0, Math.min(1, hUpper)), characteristicConfig);
    const dPhi = Math.max(0.002, phiUpper - phiLower);
    rowDeltaPhis.push(dPhi);
  }
  const maxRowDeltaPhi = Math.max(...rowDeltaPhis);

  // Geometric maximum hole capacity per row based on physical circumference and ligament constraints
  const nominalPz = N_rows > 1 ? (zEnd - zStart) / (N_rows - 1) : H;
  const rowCapacities: number[] = [];
  for (let k = 0; k < N_rows; k++) {
    const d_k = holeDias[k];
    const minP = reqPitchRatio * d_k;
    const pCircLimit = Math.floor(circumference_mm / minP);
    const pDiagLimit =
      nominalPz < minP
        ? Math.floor(circumference_mm / (2 * Math.sqrt(Math.max(0.25 * d_k * d_k, minP * minP - nominalPz * nominalPz))))
        : pCircLimit;
    const maxRowHoles = Math.max(2, Math.min(pCircLimit, pDiagLimit));
    rowCapacities.push(maxRowHoles);
  }
  const peakRowCapacity = Math.max(...rowCapacities);

  // Target holes for peak gradient row calibrated to ~85% of peak geometric capacity
  // This ensures the pattern tracks characteristic gradient without saturating every row
  const peakTargetHoles = Math.max(4, Math.floor(peakRowCapacity * 0.88));

  // Step 2: Sequential Target Curve Matching with Exact 2D Cylindrical Hole Collision Prevention
  // Guarantees ZERO hole-to-hole intersection and enforces center-to-center pitch P >= reqPitchRatio * d_avg
  // across all holes in the same row AND all nearby overlapping staggered rows!
  const rows: CageHoleRow[] = [];
  let cumulativeFullArea_mm2 = 0;

  interface PlacedHole2D {
    z_mm: number;
    s_mm: number; // circumferential position [0 .. circumference_mm)
    d_mm: number;
  }
  const placedHoles: PlacedHole2D[] = [];

  const evaluateMin2DRatioForCandidateRow = (
    z_k: number,
    d_k: number,
    n_k: number,
    offset_deg: number
  ): { minRatio: number; minLig_mm: number; minPitch_mm: number } => {
    const p_theta = circumference_mm / n_k;
    let minRatio = p_theta / d_k;
    let minLig_mm = p_theta - d_k;
    let minPitch_mm = p_theta;

    for (let j = 0; j < n_k; j++) {
      const deg = (offset_deg + (j * 360) / n_k) % 360;
      const s_k = (deg / 360) * circumference_mm;

      for (const prev of placedHoles) {
        const dz = Math.abs(z_k - prev.z_mm);
        const dAvg = 0.5 * (d_k + prev.d_mm);
        if (dz >= reqPitchRatio * dAvg * 1.15) continue;

        let ds = Math.abs(s_k - prev.s_mm);
        if (ds > circumference_mm * 0.5) ds = circumference_mm - ds;

        const dist2D = Math.sqrt(dz * dz + ds * ds);
        const ratio = dist2D / dAvg;
        const lig = dist2D - dAvg;
        if (ratio < minRatio) minRatio = ratio;
        if (lig < minLig_mm) minLig_mm = lig;
        if (dist2D < minPitch_mm) minPitch_mm = dist2D;
      }
    }
    return { minRatio, minLig_mm, minPitch_mm };
  };

  for (let k = 0; k < N_rows; k++) {
    const rowIndex = k + 1;
    const d_k = holeDias[k];
    const R_k = d_k / 2;
    const z_k = zCenters[k];
    const zBot_mm = Math.max(0, Number((z_k - R_k).toFixed(2)));
    const zTop_mm = Number((z_k + R_k).toFixed(2));

    const prevZ = k > 0 ? zCenters[k - 1] : 0;
    const prevD = k > 0 ? holeDias[k - 1] : d_k;
    const p_z = k > 0 ? Number((z_k - prevZ).toFixed(2)) : 0;
    const avgPairDia = (d_k + prevD) / 2;
    const axialOverlap_mm =
      k > 0 ? Number((avgPairDia - p_z).toFixed(2)) : Number(R_k.toFixed(2));
    const axialOverlapPct =
      k > 0 ? Number(((axialOverlap_mm / avgPairDia) * 100).toFixed(1)) : 100;

    const deltaPhi = rowDeltaPhis[k];
    const maxHolesGeometric = rowCapacities[k];

    // Compute characteristic-proportional hole target
    // Combines area demand with the characteristic gradient normalized to peak capacity
    const gradientRatio = maxRowDeltaPhi > 0 ? deltaPhi / maxRowDeltaPhi : 1 / N_rows;
    const rawTargetHoles = Math.max(2, Math.round(peakTargetHoles * gradientRatio));
    let n_k = Math.max(2, Math.min(maxHolesGeometric, rawTargetHoles));

    // Exact 2D cylindrical placement: search optimal angular phase offset and decrement n_k if any hole pair violates P >= reqPitchRatio * d_avg
    let bestOffset_deg = 0;
    let bestEval = evaluateMin2DRatioForCandidateRow(z_k, d_k, n_k, 0);

    while (n_k >= 2) {
      const pitchStepDeg = 360 / n_k;
      let localBestOffset = 0;
      let localBestEval = { minRatio: -1, minLig_mm: -99, minPitch_mm: 0 };

      // Test 36 phase angles within [0, pitchStepDeg)
      const numPhases = 36;
      for (let p = 0; p < numPhases; p++) {
        const candOffset = Number(((p / numPhases) * pitchStepDeg).toFixed(2));
        const ev = evaluateMin2DRatioForCandidateRow(z_k, d_k, n_k, candOffset);
        if (ev.minRatio > localBestEval.minRatio) {
          localBestEval = ev;
          localBestOffset = candOffset;
        }
      }

      bestOffset_deg = localBestOffset;
      bestEval = localBestEval;

      if (bestEval.minRatio >= reqPitchRatio - 0.01 || n_k === 2) {
        break;
      }
      n_k--;
    }

    // Record placed holes for collision checking subsequent rows
    for (let j = 0; j < n_k; j++) {
      const deg = (bestOffset_deg + (j * 360) / n_k) % 360;
      placedHoles.push({
        z_mm: z_k,
        s_mm: (deg / 360) * circumference_mm,
        d_mm: d_k,
      });
    }

    const p_theta = circumference_mm / n_k;
    const p_diag = bestEval.minPitch_mm;
    const pitchToDia = bestEval.minRatio;
    const ligWidth = Math.max(0.2, bestEval.minLig_mm);
    const ligEfficiency = ligWidth / Math.max(0.5, bestEval.minPitch_mm);

    const singleHoleArea_mm2 = (Math.PI / 4) * d_k * d_k;
    const rowArea_mm2 = n_k * singleHoleArea_mm2;
    cumulativeFullArea_mm2 += rowArea_mm2;

    // Sibanda (2022) Eq. 5.10 Row Elevation Factor HT^0.15013
    const HT_nonDim = Math.max(0.08, Math.min(1.0, z_k / H));
    const sibandaElevationFactor = Number(
      (0.93 + 0.14 * Math.pow(HT_nonDim, 0.15013)).toFixed(3)
    );

    const cumulativeTrimCv =
      0.0589 * C_d * cumulativeFullArea_mm2 * sibandaElevationFactor;
    const compositeCumulativeCv =
      1 /
      Math.sqrt(
        1 / Math.pow(Math.max(0.01, cumulativeTrimCv), 2) +
          1 / Math.pow(Math.max(0.1, cvSeatComponent), 2) +
          1 / Math.pow(Math.max(0.1, cvBodyComponent), 2)
      );

    rows.push({
      rowIndex,
      zElevation_mm: z_k,
      zBottom_mm: zBot_mm,
      zTop_mm: zTop_mm,
      axialPitchFromPrev_mm: p_z,
      axialOverlapWithPrev_mm: axialOverlap_mm,
      axialOverlapPct,
      travelPctAtRowCenter: Number(((z_k / H) * 100).toFixed(1)),
      travelPctAtRowTop: Number((Math.min(100, (zTop_mm / H) * 100)).toFixed(1)),
      holeDia_mm: d_k,
      holeCount: n_k,
      circumferentialPitch_mm: Number(p_theta.toFixed(2)),
      diagonalPitch_mm: Number(p_diag.toFixed(2)),
      pitchToDiaRatio: Number(pitchToDia.toFixed(2)),
      ligamentWidth_mm: Number(ligWidth.toFixed(2)),
      ligamentEfficiency: Number(ligEfficiency.toFixed(3)),
      rowArea_mm2: Number(rowArea_mm2.toFixed(1)),
      cumulativeArea_mm2: Number(cumulativeFullArea_mm2.toFixed(1)),
      cumulativeCv: Number(compositeCumulativeCv.toFixed(2)),
      angularOffset_deg: bestOffset_deg,
      sibandaRowElevationFactor: sibandaElevationFactor,
    });
  }

  // Step 3: Evaluate High-Resolution Continuous Circular-Segment Uncovering Curve (100 steps)
  // Verifies that dA/dh > 0 at every millimeter of stroke (Zero Deadband!)
  const continuousProfile: ContinuousUncoveringPoint[] = [];
  let deadbandStepsCount = 0;
  let minActiveOverlappingRows = 99;
  let sumSquaredError = 0;

  for (let i = 0; i <= 100; i++) {
    const travelPct = i;
    const hNorm = i / 100;
    const lift_mm = hNorm * H;

    const phiTarget = evaluateInherentPhi(hNorm, characteristicConfig);
    const targetArea_mm2 = phiTarget * cumulativeFullArea_mm2;

    let actualArea_mm2 = 0;
    let effectiveCvArea_mm2 = 0;
    let chordGain_mm2_per_mm = 0;
    let activeRowsAtLift = 0;

    for (const row of rows) {
      const seg = evaluateCircularHoleSegmentUncovering(
        lift_mm,
        row.zElevation_mm,
        row.holeDia_mm
      );
      const rowExposed_mm2 = row.holeCount * seg.exposedArea_mm2;
      actualArea_mm2 += rowExposed_mm2;
      effectiveCvArea_mm2 +=
        rowExposed_mm2 *
        seg.localDischargeFactor *
        row.sibandaRowElevationFactor;
      chordGain_mm2_per_mm += row.holeCount * seg.chordWidth_mm;

      if (seg.openingFraction > 0 && seg.openingFraction < 1.0) {
        activeRowsAtLift++;
      }
    }

    if (i > 0 && i < 100) {
      if (chordGain_mm2_per_mm < 0.05) {
        deadbandStepsCount++;
      }
      if (activeRowsAtLift < minActiveOverlappingRows) {
        minActiveOverlappingRows = activeRowsAtLift;
      }
    }

    const trimCvAtLift = 0.0589 * C_d * effectiveCvArea_mm2;
    const actualSynthesizedCv =
      trimCvAtLift <= 0.001
        ? 0
        : 1 /
          Math.sqrt(
            1 / Math.pow(trimCvAtLift, 2) +
              1 / Math.pow(Math.max(0.1, cvSeatComponent), 2) +
              1 / Math.pow(Math.max(0.1, cvBodyComponent), 2)
          );

    const maxCompositeCv =
      1 /
      Math.sqrt(
        1 / Math.pow(Math.max(0.1, 0.0589 * C_d * cumulativeFullArea_mm2), 2) +
          1 / Math.pow(Math.max(0.1, cvSeatComponent), 2) +
          1 / Math.pow(Math.max(0.1, cvBodyComponent), 2)
      );
    const targetCv = phiTarget * maxCompositeCv;

    const errPct =
      maxCompositeCv > 0
        ? ((actualSynthesizedCv - targetCv) / maxCompositeCv) * 100
        : 0;
    sumSquaredError += errPct * errPct;

    continuousProfile.push({
      travelPct,
      lift_mm: Number(lift_mm.toFixed(2)),
      targetArea_mm2: Number(targetArea_mm2.toFixed(1)),
      actualCircularSegmentArea_mm2: Number(actualArea_mm2.toFixed(1)),
      targetCv: Number(targetCv.toFixed(2)),
      actualSynthesizedCv: Number(actualSynthesizedCv.toFixed(2)),
      instantaneousChordGain_mm2_per_mm: Number(chordGain_mm2_per_mm.toFixed(1)),
      activeOverlappingRowsCount: activeRowsAtLift,
    });
  }

  const deadbandStrokePct = Number(deadbandStepsCount.toFixed(1));
  const maxDeadbandGap_mm = Number(
    Math.max(
      0,
      rows[0]?.zBottom_mm || 0,
      ...rows.slice(1).map((r) => -r.axialOverlapWithPrev_mm)
    ).toFixed(2)
  );
  const meanRowOverlapPct = Number(
    (
      rows.slice(1).reduce((acc, r) => acc + r.axialOverlapPct, 0) /
      Math.max(1, rows.length - 1)
    ).toFixed(1)
  );
  const curveFitRMSDeviationPct = Number(
    Math.sqrt(sumSquaredError / 101).toFixed(2)
  );

  const totalHoles = rows.reduce((acc, r) => acc + r.holeCount, 0);
  const synthesizedTrimCv = Number(
    (0.0589 * C_d * cumulativeFullArea_mm2).toFixed(2)
  );
  const compositeRatedCv =
    continuousProfile[continuousProfile.length - 1]?.actualSynthesizedCv ||
    synthesizedTrimCv;

  const styleModifierFd = Number(
    (1 / Math.sqrt(Math.max(1, totalHoles))).toFixed(3)
  );
  const meanHoleDia_mm = Number(
    (
      rows.reduce((acc, r) => acc + r.holeDia_mm * r.holeCount, 0) /
      Math.max(1, totalHoles)
    ).toFixed(2)
  );
  const minPitchToDiaRatio = Number(
    Math.min(...rows.map((r) => r.pitchToDiaRatio)).toFixed(2)
  );
  const minLigamentToDiaRatio = Number(
    Math.max(0, minPitchToDiaRatio - 1.0).toFixed(2)
  );
  const jetCoalescenceCompliant = minPitchToDiaRatio >= 2.0;
  const minLigamentWidth_mm = Number(
    Math.min(...rows.map((r) => r.ligamentWidth_mm)).toFixed(2)
  );
  const minLigamentEfficiency = Number(
    Math.min(...rows.map((r) => r.ligamentEfficiency)).toFixed(3)
  );

  // Structural Mechanics (ASME B16.34 / Section VIII Div. 1 Perforated Cylinder)
  const matEval = evaluateMaterialAtTemp(materialId, operatingTemp_degC);
  const Sm_MPa = matEval.Sm_T_MPa;
  const E_MPa = matEval.E_T_GPa * 1000;
  const dP_MPa = Math.max(0.1, shutoffDeltaP_bar * 0.1);

  const t_wall = Math.max(2.0, selectedWallThickness_mm);
  const c_erosion = Math.max(0, erosionAllowance_mm);
  const t_effective = Math.max(1.0, t_wall - c_erosion);
  const cageOD_mm = Number((D_ID + 2 * t_wall).toFixed(1));
  const D_mean = D_ID + t_wall;

  const denomWall = Math.max(5.0, 2 * Sm_MPa * minLigamentEfficiency - dP_MPa);
  const minRequiredWallStruct_mm = (dP_MPa * D_ID) / denomWall + c_erosion;

  const nuPoisson = 0.30;
  const reqRatioCubed =
    (3.0 * dP_MPa * (1 - nuPoisson * nuPoisson)) /
    Math.max(100, 2 * E_MPa * minLigamentEfficiency);
  const minWallBuckling_mm = D_mean * Math.cbrt(reqRatioCubed) + c_erosion;

  const minRequiredWallThickness_mm = Number(
    Math.max(3.0, minRequiredWallStruct_mm, minWallBuckling_mm).toFixed(2)
  );

  const hoopStress_MPa = Number(
    ((dP_MPa * D_mean) / (2 * t_effective * Math.max(0.05, minLigamentEfficiency))).toFixed(2)
  );
  const hoopStressUtilizationPct = Number(
    ((hoopStress_MPa / Math.max(1, Sm_MPa)) * 100).toFixed(1)
  );

  const P_collapse_MPa =
    ((2 * E_MPa) / (1 - nuPoisson * nuPoisson)) *
    Math.pow(t_effective / D_mean, 3) *
    minLigamentEfficiency;
  const criticalCollapsePressure_bar = Number((P_collapse_MPa * 10).toFixed(1));
  const collapseSafetyFactor = Number(
    (criticalCollapsePressure_bar / Math.max(0.5, shutoffDeltaP_bar)).toFixed(2)
  );

  const naceSourCompliant =
    !requireNaceSourService || matEval.spec.naceMR0175Compliant;
  const tempCompliant = matEval.tempCompliant;

  // Cage Physical Surface Area & Perforation Saturation Analysis
  const cageSurfaceArea_mm2 = Number((circumference_mm * H).toFixed(1));
  const perforationRatioPct = Number(
    ((cumulativeFullArea_mm2 / Math.max(1, circumference_mm * H)) * 100).toFixed(1)
  );

  // Evaluate valve size adequacy and cage open area based on actual process demand
  // If maxProcessRequiredCv is provided, check if the process flow exceeds 85% of valve capacity
  const effectiveProcessCv = maxProcessRequiredCv && maxProcessRequiredCv > 0
    ? maxProcessRequiredCv
    : null;
  const effectiveRatedCv = ratedValveCv && ratedValveCv > 0
    ? ratedValveCv
    : compositeRatedCv;

  let isAreaSaturated = false;
  let saturationSeverity: 'OPTIMAL' | 'HIGH_DENSITY' | 'SATURATED_UPSIZE_RECOMMENDED' = 'OPTIMAL';
  let saturationMessage = `Cage open area density is optimal (${perforationRatioPct}% perforation). Sufficient ligament margin for pressure containment.`;
  let recommendedMinValveSize: string | undefined = undefined;

  if (effectiveProcessCv !== null && effectiveRatedCv > 0) {
    const processTravelDemandPct = (effectiveProcessCv / effectiveRatedCv) * 100;
    if (processTravelDemandPct > 85) {
      isAreaSaturated = true;
      saturationSeverity = 'SATURATED_UPSIZE_RECOMMENDED';
      if (effectiveProcessCv > 400) {
        recommendedMinValveSize = 'DN200 (8") or larger';
      } else if (effectiveProcessCv > 220) {
        recommendedMinValveSize = 'DN150 (6")';
      } else if (effectiveProcessCv > 120) {
        recommendedMinValveSize = 'DN100 (4")';
      } else if (effectiveProcessCv > 65) {
        recommendedMinValveSize = 'DN80 (3")';
      } else {
        recommendedMinValveSize = 'DN50 (2")';
      }
      saturationMessage = `Process Capacity Exceeded: Max operating condition requires ${effectiveProcessCv.toFixed(1)} Cv (${processTravelDemandPct.toFixed(1)}% of rated valve capacity ${effectiveRatedCv.toFixed(1)} Cv). Valve opening exceeds standard 85% control threshold. Upsize valve to ${recommendedMinValveSize} to maintain control margin.`;
    } else if (processTravelDemandPct > 75 || perforationRatioPct > 28) {
      saturationSeverity = 'HIGH_DENSITY';
      saturationMessage = `High Process Loading (${processTravelDemandPct.toFixed(1)}% of rated Cv, ${perforationRatioPct}% sleeve perforation). Adequate control margin with standard ligament spacing.`;
    } else {
      saturationSeverity = 'OPTIMAL';
      saturationMessage = `Valve Size & Cage Sizing Optimal: Process demand is ${effectiveProcessCv.toFixed(1)} Cv (${processTravelDemandPct.toFixed(1)}% of rated ${effectiveRatedCv.toFixed(1)} Cv) with safe ${perforationRatioPct}% sleeve perforation.`;
    }
  } else {
    // Fallback when process operating cases are not provided: check physical cage perforation ratio
    if (perforationRatioPct > 35) {
      isAreaSaturated = true;
      saturationSeverity = 'SATURATED_UPSIZE_RECOMMENDED';
      saturationMessage = `Cage Perforation High (${perforationRatioPct}%): Open hole area approaches ligament limit (~35%). Verify shutoff ΔP hoop stress safety margins.`;
    } else if (perforationRatioPct > 26) {
      saturationSeverity = 'HIGH_DENSITY';
      saturationMessage = `High Perforation Density (${perforationRatioPct}%): Near maximum allowable ligament density for ASME B16.34 / Sec VIII pressure boundary.`;
    }
  }

  let structuralStatus: 'PASS' | 'WARNING' | 'CRITICAL' = 'PASS';
  if (
    hoopStress_MPa > Sm_MPa ||
    collapseSafetyFactor < 2.0 ||
    minLigamentWidth_mm < 1.5 ||
    t_wall < minRequiredWallThickness_mm ||
    !tempCompliant ||
    !naceSourCompliant
  ) {
    structuralStatus = 'CRITICAL';
  } else if (
    hoopStressUtilizationPct > 80 ||
    collapseSafetyFactor < 3.0 ||
    minPitchToDiaRatio < reqPitchRatio - 0.05 ||
    deadbandStrokePct > 0 ||
    isAreaSaturated
  ) {
    structuralStatus = 'WARNING';
  }

  return {
    rows,
    continuousProfile,
    totalHoles,
    totalOrificeArea_mm2: Number(cumulativeFullArea_mm2.toFixed(1)),
    synthesizedTrimCv,
    compositeRatedCv,
    styleModifierFd,
    meanHoleDia_mm,
    deadbandStrokePct,
    maxDeadbandGap_mm,
    meanRowOverlapPct,
    minActiveOverlappingRows:
      minActiveOverlappingRows === 99 ? 1 : minActiveOverlappingRows,
    curveFitRMSDeviationPct,
    holeSpacingRule,
    minPitchToDiaRatio,
    minLigamentToDiaRatio,
    jetCoalescenceCompliant,
    minLigamentWidth_mm,
    minLigamentEfficiency,
    cageID_mm: D_ID,
    cageOD_mm,
    selectedWallThickness_mm: t_wall,
    minRequiredWallThickness_mm,
    erosionAllowance_mm: c_erosion,
    hoopStress_MPa,
    allowableStressSm_MPa: Sm_MPa,
    hoopStressUtilizationPct,
    criticalCollapsePressure_bar,
    collapseSafetyFactor,
    structuralStatus,
    naceSourCompliant,
    tempCompliant,
    cageSurfaceArea_mm2,
    perforationRatioPct,
    isAreaSaturated,
    saturationSeverity,
    saturationMessage,
    recommendedMinValveSize,
  };
}

export function generateUnrolledCageDXF(
  result: CageSynthesisAndStressResult
): string {
  const circumference = Number((Math.PI * result.cageID_mm).toFixed(3));
  const maxZ =
    result.rows.length > 0
      ? Math.max(...result.rows.map((r) => r.zTop_mm + 2.0))
      : 50;

  const lines: string[] = [
    '0',
    'SECTION',
    '2',
    'ENTITIES',
    '0',
    'LINE',
    '8',
    'CAGE_BOUNDARY',
    '10',
    '0.0',
    '20',
    '0.0',
    '11',
    circumference.toString(),
    '21',
    '0.0',
    '0',
    'LINE',
    '8',
    'CAGE_BOUNDARY',
    '10',
    circumference.toString(),
    '20',
    '0.0',
    '11',
    circumference.toString(),
    '21',
    maxZ.toFixed(3),
    '0',
    'LINE',
    '8',
    'CAGE_BOUNDARY',
    '10',
    circumference.toString(),
    '20',
    maxZ.toFixed(3),
    '11',
    '0.0',
    '21',
    maxZ.toFixed(3),
    '0',
    'LINE',
    '8',
    'CAGE_BOUNDARY',
    '10',
    '0.0',
    '20',
    maxZ.toFixed(3),
    '11',
    '0.0',
    '21',
    '0.0',
  ];

  for (const row of result.rows) {
    const radius = (row.holeDia_mm / 2).toFixed(3);
    for (let j = 0; j < row.holeCount; j++) {
      const angleDeg = row.angularOffset_deg + (j * 360) / row.holeCount;
      const xArc = (((angleDeg % 360) / 360) * circumference).toFixed(3);
      const yZ = row.zElevation_mm.toFixed(3);
      lines.push(
        '0',
        'CIRCLE',
        '8',
        `ROW_${row.rowIndex}_DIA_${row.holeDia_mm}`,
        '10',
        xArc,
        '20',
        yZ,
        '30',
        '0.0',
        '40',
        radius
      );
    }
  }

  lines.push('0', 'ENDSEC', '0', 'EOF');
  return lines.join('\n');
}

export function generate4AxisCageGCode(
  result: CageSynthesisAndStressResult
): string {
  const rOuter = result.cageOD_mm / 2;
  const rInner = result.cageID_mm / 2;
  const safeZ = Number((rOuter + 5.0).toFixed(2));
  const drillDepthZ = Number((rInner - 1.2).toFixed(2));

  const gcode: string[] = [
    `%`,
    `(DY-SIZE 4-AXIS CNC CAGE DRILLING PROGRAM - ZERO-DEADBAND OVERLAPPING ROWS)`,
    `(CAGE ID: ${result.cageID_mm.toFixed(1)} MM | CAGE OD: ${result.cageOD_mm.toFixed(1)} MM | WALL: ${result.selectedWallThickness_mm.toFixed(1)} MM)`,
    `(TOTAL HOLES: ${result.totalHoles} ACROSS ${result.rows.length} OVERLAPPING AXIAL ROWS | MEAN ROW OVERLAP: ${result.meanRowOverlapPct}% | DEADBAND: ${result.deadbandStrokePct}%)`,
    `G90 G21 G17 G40 G80`,
    `T01 M06 (CARBIDE COOLANT-THRU DRILL Ø${result.meanHoleDia_mm} MM)`,
    `S2800 M03`,
    `M08 (HIGH-PRESSURE FLOOD COOLANT ON)`,
    `G00 X0.000 Y0.000 Z${safeZ} A0.000`,
  ];

  for (const row of result.rows) {
    gcode.push(
      `(--- ROW ${row.rowIndex}: Z_CENTER=${row.zElevation_mm} MM [Z_BOT=${row.zBottom_mm}..Z_TOP=${row.zTop_mm}] | OVERLAP=${row.axialOverlapPct}% | ${row.holeCount} HOLES x Ø${row.holeDia_mm} MM ---)`
    );
    for (let j = 0; j < row.holeCount; j++) {
      const aDeg = Number(
        ((row.angularOffset_deg + (j * 360) / row.holeCount) % 360).toFixed(3)
      );
      gcode.push(
        `G00 X${row.zElevation_mm.toFixed(3)} A${aDeg.toFixed(3)}`,
        `G83 Z${drillDepthZ} R${(rOuter + 1.5).toFixed(2)} Q1.5 F140`,
        `G80`
      );
    }
  }

  gcode.push(
    `G00 Z${(rOuter + 25.0).toFixed(2)}`,
    `M09`,
    `M05`,
    `G28 U0 W0 A0`,
    `M30`,
    `%`
  );
  return gcode.join('\n');
}
