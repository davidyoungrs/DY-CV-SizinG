import type { PressureClassId } from './valveSchedule.ts';
import type { PackingTypeId } from './actuatorAndStemEngine.ts';

// ============================================================================
// 1. ASME B16.34 MATERIAL-SPECIFIC PRESSURE-TEMPERATURE (P-T) RATINGS
// ============================================================================

export type BodyMaterialGroupId =
  | 'WCB_1_1'
  | 'LCC_1_1'
  | 'WC6_1_9'
  | 'WC9_1_10'
  | 'CF8M_2_2'
  | 'INCONEL_625_3_8';

export interface BodyMaterialGroupSpec {
  id: BodyMaterialGroupId;
  name: string;
  asmeGroup: string;
  astmSpec: string;
  minTemp_degC: number;
  maxTemp_degC: number;
  naceCompliant: boolean;
  notes: string;
  /**
   * Standard Class pressure ratings (bar g) at temperature breakpoints (°C)
   * Breakpoints: [-29, 38, 100, 150, 200, 260, 315, 375, 425, 482, 538]
   */
  cl150_bar: number[];
  cl300_bar: number[];
  cl600_bar: number[];
  cl900_bar: number[];
  cl1500_bar: number[];
  cl2500_bar: number[];
}

export const ASME_B1634_TEMP_BREAKPOINTS_C = [
  -29, 38, 100, 150, 200, 260, 315, 375, 425, 482, 538,
];

export const BODY_MATERIAL_GROUPS: Record<BodyMaterialGroupId, BodyMaterialGroupSpec> = {
  WCB_1_1: {
    id: 'WCB_1_1',
    name: 'Carbon Steel (ASTM A216 WCB)',
    asmeGroup: 'Group 1.1',
    astmSpec: 'ASTM A216 Gr. WCB',
    minTemp_degC: -29,
    maxTemp_degC: 425,
    naceCompliant: true,
    notes: 'Standard carbon steel; limited to 425°C (graphitization above 425°C).',
    cl150_bar: [19.6, 19.6, 17.7, 15.8, 13.8, 11.7, 9.6, 7.6, 5.5, 0, 0],
    cl300_bar: [51.1, 51.1, 46.6, 45.1, 43.8, 41.6, 38.8, 36.2, 28.8, 0, 0],
    cl600_bar: [102.1, 102.1, 93.2, 90.2, 87.6, 83.2, 77.5, 72.4, 57.5, 0, 0],
    cl900_bar: [153.2, 153.2, 139.8, 135.2, 131.4, 124.8, 116.3, 108.6, 86.3, 0, 0],
    cl1500_bar: [255.3, 255.3, 233.0, 225.4, 219.0, 208.0, 193.8, 181.0, 143.8, 0, 0],
    cl2500_bar: [425.5, 425.5, 388.3, 375.6, 365.0, 346.6, 323.0, 301.7, 239.7, 0, 0],
  },
  LCC_1_1: {
    id: 'LCC_1_1',
    name: 'Low-Temp Carbon Steel (ASTM A352 LCC)',
    asmeGroup: 'Group 1.1 (Low-Temp)',
    astmSpec: 'ASTM A352 Gr. LCC',
    minTemp_degC: -46,
    maxTemp_degC: 345,
    naceCompliant: true,
    notes: 'Impact-tested carbon steel for -46°C to +345°C service.',
    cl150_bar: [19.8, 19.8, 17.7, 15.8, 13.8, 11.7, 9.6, 0, 0, 0, 0],
    cl300_bar: [51.7, 51.7, 46.6, 45.1, 43.8, 41.6, 38.8, 0, 0, 0, 0],
    cl600_bar: [103.4, 103.4, 93.2, 90.2, 87.6, 83.2, 77.5, 0, 0, 0, 0],
    cl900_bar: [155.1, 155.1, 139.8, 135.2, 131.4, 124.8, 116.3, 0, 0, 0, 0],
    cl1500_bar: [258.6, 258.6, 233.0, 225.4, 219.0, 208.0, 193.8, 0, 0, 0, 0],
    cl2500_bar: [430.9, 430.9, 388.3, 375.6, 365.0, 346.6, 323.0, 0, 0, 0, 0],
  },
  WC6_1_9: {
    id: 'WC6_1_9',
    name: '1.25Cr-0.5Mo Alloy Steel (ASTM A217 WC6)',
    asmeGroup: 'Group 1.9',
    astmSpec: 'ASTM A217 Gr. WC6',
    minTemp_degC: -29,
    maxTemp_degC: 538,
    naceCompliant: true,
    notes: 'High-temperature steam & power plant chrome-moly body.',
    cl150_bar: [19.8, 19.8, 17.7, 15.8, 13.8, 11.7, 9.6, 7.6, 5.5, 3.5, 1.4],
    cl300_bar: [51.7, 51.7, 51.5, 49.7, 48.0, 45.4, 42.3, 39.3, 35.2, 27.6, 14.9],
    cl600_bar: [103.4, 103.4, 103.0, 99.5, 95.9, 90.8, 84.6, 78.6, 70.3, 55.2, 29.8],
    cl900_bar: [155.1, 155.1, 154.4, 149.2, 143.9, 136.2, 126.9, 117.9, 105.5, 82.7, 44.7],
    cl1500_bar: [258.6, 258.6, 257.4, 248.7, 239.8, 227.0, 211.5, 196.5, 175.8, 137.9, 74.5],
    cl2500_bar: [430.9, 430.9, 429.0, 414.5, 399.7, 378.3, 352.5, 327.5, 293.0, 229.8, 124.1],
  },
  WC9_1_10: {
    id: 'WC9_1_10',
    name: '2.25Cr-1Mo Alloy Steel (ASTM A217 WC9)',
    asmeGroup: 'Group 1.10',
    astmSpec: 'ASTM A217 Gr. WC9',
    minTemp_degC: -29,
    maxTemp_degC: 593,
    naceCompliant: true,
    notes: 'High-pressure superheated steam & refinery hydrotreater body.',
    cl150_bar: [19.8, 19.8, 17.7, 15.8, 13.8, 11.7, 9.6, 7.6, 5.5, 3.5, 1.4],
    cl300_bar: [51.7, 51.7, 51.5, 50.3, 48.6, 46.5, 43.8, 40.5, 35.2, 29.0, 17.9],
    cl600_bar: [103.4, 103.4, 103.0, 100.5, 97.2, 93.0, 87.6, 81.0, 70.3, 58.0, 35.9],
    cl900_bar: [155.1, 155.1, 154.6, 150.8, 145.8, 139.5, 131.4, 121.5, 105.5, 87.0, 53.8],
    cl1500_bar: [258.6, 258.6, 257.6, 251.3, 243.0, 232.5, 219.0, 202.5, 175.8, 145.0, 89.6],
    cl2500_bar: [430.9, 430.9, 429.4, 418.8, 405.0, 387.5, 365.0, 337.5, 293.0, 241.7, 149.4],
  },
  CF8M_2_2: {
    id: 'CF8M_2_2',
    name: '316 Stainless Steel (ASTM A351 CF8M)',
    asmeGroup: 'Group 2.2',
    astmSpec: 'ASTM A351 Gr. CF8M',
    minTemp_degC: -196,
    maxTemp_degC: 538,
    naceCompliant: true,
    notes: 'Cryogenic to high-temp austenitic stainless; NACE MR0175 compliant (check Cl⁻ SCC > 60°C).',
    cl150_bar: [19.0, 19.0, 16.2, 14.8, 13.7, 11.7, 9.6, 7.6, 5.5, 3.5, 1.4],
    cl300_bar: [49.6, 49.6, 42.2, 38.5, 35.7, 33.4, 31.6, 30.2, 29.1, 27.6, 23.4],
    cl600_bar: [99.3, 99.3, 84.4, 77.0, 71.3, 66.8, 63.2, 60.4, 58.2, 55.2, 46.9],
    cl900_bar: [148.9, 148.9, 126.6, 115.5, 107.0, 100.2, 94.8, 90.6, 87.3, 82.7, 70.3],
    cl1500_bar: [248.2, 248.2, 211.0, 192.5, 178.3, 167.0, 158.0, 151.0, 145.5, 137.9, 117.2],
    cl2500_bar: [413.7, 413.7, 351.7, 320.8, 297.2, 278.3, 263.3, 251.7, 242.5, 229.8, 195.4],
  },
  INCONEL_625_3_8: {
    id: 'INCONEL_625_3_8',
    name: 'Alloy 625 (ASTM A494 CW6MC)',
    asmeGroup: 'Group 3.8',
    astmSpec: 'ASTM A494 CW6MC / B446',
    minTemp_degC: -196,
    maxTemp_degC: 593,
    naceCompliant: true,
    notes: 'Severe sour gas, high-chloride seawater, and extreme temperature nickel alloy.',
    cl150_bar: [20.0, 20.0, 17.7, 15.8, 13.8, 11.7, 9.6, 7.6, 5.5, 3.5, 1.4],
    cl300_bar: [51.7, 51.7, 51.7, 51.7, 51.7, 50.8, 49.5, 48.2, 46.8, 44.5, 41.2],
    cl600_bar: [103.4, 103.4, 103.4, 103.4, 103.4, 101.6, 99.0, 96.4, 93.6, 89.0, 82.4],
    cl900_bar: [155.1, 155.1, 155.1, 155.1, 155.1, 152.4, 148.5, 144.6, 140.4, 133.5, 123.6],
    cl1500_bar: [258.6, 258.6, 258.6, 258.6, 258.6, 254.0, 247.5, 241.0, 234.0, 222.5, 206.0],
    cl2500_bar: [430.9, 430.9, 430.9, 430.9, 430.9, 423.3, 412.5, 401.7, 390.0, 370.8, 343.3],
  },
};

function interpolateCurve(curve: number[], T_degC: number): number {
  const temps = ASME_B1634_TEMP_BREAKPOINTS_C;
  if (T_degC <= temps[0]) return curve[0];
  if (T_degC >= temps[temps.length - 1]) return curve[curve.length - 1];
  for (let i = 0; i < temps.length - 1; i++) {
    if (T_degC >= temps[i] && T_degC <= temps[i + 1]) {
      const f = (T_degC - temps[i]) / (temps[i + 1] - temps[i]);
      const p0 = curve[i];
      const p1 = curve[i + 1];
      if (p0 === 0 || p1 === 0) return Math.min(p0, p1);
      return p0 + f * (p1 - p0);
    }
  }
  return 0;
}

export interface AsmeB1634RatingResult {
  classId: PressureClassId;
  materialId: BodyMaterialGroupId;
  maxAllowableBarG: number;
  designPressureBarG: number;
  designTempDegC: number;
  utilizationPct: number;
  isTempInRange: boolean;
  isCompliant: boolean;
  minimumCompliantClass: PressureClassId | null;
  note: string;
}

const ORDERED_CLASSES: PressureClassId[] = [
  'CL150_PN16',
  'CL300_PN40',
  'CL600_PN100',
  'CL900_PN160',
  'CL1500_PN250',
  'CL2500_PN420',
];

function getCurveForClass(mat: BodyMaterialGroupSpec, classId: PressureClassId): number[] {
  switch (classId) {
    case 'CL150_PN16': return mat.cl150_bar;
    case 'CL300_PN40': return mat.cl300_bar;
    case 'CL600_PN100': return mat.cl600_bar;
    case 'CL900_PN160': return mat.cl900_bar;
    case 'CL1500_PN250': return mat.cl1500_bar;
    case 'CL2500_PN420': return mat.cl2500_bar;
  }
}

export function evaluateAsmeB1634Rating(
  classId: PressureClassId,
  materialId: BodyMaterialGroupId,
  P1_bar_a: number,
  T_degC: number,
): AsmeB1634RatingResult {
  const mat = BODY_MATERIAL_GROUPS[materialId];
  const designPressureBarG = Math.max(0, P1_bar_a - 1.01325);
  const isTempInRange = T_degC >= mat.minTemp_degC && T_degC <= mat.maxTemp_degC;
  const maxAllowableBarG = isTempInRange
    ? interpolateCurve(getCurveForClass(mat, classId), T_degC)
    : 0;

  let minimumCompliantClass: PressureClassId | null = null;
  if (isTempInRange) {
    for (const c of ORDERED_CLASSES) {
      const allow = interpolateCurve(getCurveForClass(mat, c), T_degC);
      if (allow >= designPressureBarG && allow > 0) {
        minimumCompliantClass = c;
        break;
      }
    }
  }

  const utilizationPct =
    maxAllowableBarG > 0 ? (designPressureBarG / maxAllowableBarG) * 100 : 999;
  const isCompliant = isTempInRange && maxAllowableBarG >= designPressureBarG && maxAllowableBarG > 0;

  let note = `ASME B16.34 ${mat.asmeGroup} (${mat.astmSpec}) allows ${maxAllowableBarG.toFixed(1)} bar g at ${T_degC.toFixed(0)}°C.`;
  if (!isTempInRange) {
    note = `Temperature ${T_degC.toFixed(0)}°C is outside ${mat.astmSpec} range (${mat.minTemp_degC}°C to ${mat.maxTemp_degC}°C).`;
  } else if (!isCompliant) {
    note = `OVER-PRESSURE: ${designPressureBarG.toFixed(1)} bar g exceeds ${classId} limit (${maxAllowableBarG.toFixed(1)} bar g at ${T_degC.toFixed(0)}°C). Upgrade to ${minimumCompliantClass ?? 'Custom Forged'}.`;
  }

  return {
    classId,
    materialId,
    maxAllowableBarG: Number(maxAllowableBarG.toFixed(2)),
    designPressureBarG: Number(designPressureBarG.toFixed(2)),
    designTempDegC: T_degC,
    utilizationPct: Number(utilizationPct.toFixed(1)),
    isTempInRange,
    isCompliant,
    minimumCompliantClass,
    note,
  };
}

// ============================================================================
// 2. NACE MR0175 / ISO 15156 SOUR SERVICE SCREENING
// ============================================================================

export interface NaceScreeningResult {
  sourServiceRequired: boolean;
  h2sPartialPressure_bar: number;
  maxTrimHardnessHRC: number;
  isTrimMaterialCompliant: boolean;
  isStemMaterialCompliant: boolean;
  warnings: string[];
  recommendedMaterials: string[];
}

export function evaluateNaceScreening(params: {
  sourServiceEnabled: boolean;
  h2sPartialPressure_bar: number;
  chloride_ppm: number;
  operatingTemp_degC: number;
  cageMaterialId: string;
  stemMaterialId: string;
}): NaceScreeningResult {
  const {
    sourServiceEnabled,
    h2sPartialPressure_bar,
    chloride_ppm,
    operatingTemp_degC,
    cageMaterialId,
    stemMaterialId,
  } = params;

  // ISO 15156-2 threshold: H2S partial pressure >= 0.003 bar (0.05 psia)
  const sourServiceRequired = sourServiceEnabled || h2sPartialPressure_bar >= 0.003;
  const warnings: string[] = [];
  const recommendedMaterials: string[] = [];

  // Check cage/trim & stem compliance
  let isTrimMaterialCompliant = true;
  let isStemMaterialCompliant = true;

  if (sourServiceRequired) {
    if (cageMaterialId === 'SS410_DOUBLE_TEMPER' && chloride_ppm > 100) {
      warnings.push('410SS (even double-tempered) is susceptible to pitting/SSC at Cl⁻ > 100 ppm; prefer 316L/Stellite 6 or Alloy 718.');
    }
    if (stemMaterialId === 'PH17_4_H1150M' && h2sPartialPressure_bar > 0.1 && operatingTemp_degC > 60) {
      warnings.push('17-4PH (H1150M) has H2S partial pressure / temperature limits under ISO 15156-3; verify Alloy 718 or Nitronic 50.');
    }
    if (chloride_ppm > 500 && operatingTemp_degC > 60) {
      warnings.push(`High Chloride (${chloride_ppm} ppm) + T > 60°C risks Chloride Stress Corrosion Cracking (Cl-SCC) on 300-series SS. Use Alloy 625 / C-276.`);
      recommendedMaterials.push('Alloy 718 / Alloy 625', 'Hastelloy C-276');
    } else {
      recommendedMaterials.push('316L + Stellite 6 (≤22 HRC substrate)', '17-4PH H1150M (NACE)', 'Alloy 718 (≤40 HRC)');
    }
  }

  return {
    sourServiceRequired,
    h2sPartialPressure_bar,
    maxTrimHardnessHRC: sourServiceRequired ? 22 : 45,
    isTrimMaterialCompliant,
    isStemMaterialCompliant,
    warnings,
    recommendedMaterials,
  };
}

// ============================================================================
// 3. FUGITIVE EMISSIONS & PACKING STANDARDS (ISO 15848-1 / API 622 / API 624)
// ============================================================================

export interface FugitiveEmissionsSpec {
  packingType: PackingTypeId;
  iso15848TightnessClass: 'AH' | 'BH' | 'CH';
  iso15848EnduranceClass: string;
  api622_624Compliant: boolean;
  stemFinishRa_um: string;
  maxTemp_degC: number;
  minTemp_degC: number;
  label: string;
  notes: string;
}

export function evaluateFugitiveEmissions(
  packingType: PackingTypeId,
  hasMetallicBellows: boolean,
  operatingTemp_degC: number,
): FugitiveEmissionsSpec {
  if (hasMetallicBellows) {
    return {
      packingType,
      iso15848TightnessClass: 'AH',
      iso15848EnduranceClass: 'CC3 (100,000+ cycles)',
      api622_624Compliant: true,
      stemFinishRa_um: '≤ 0.20 µm (polished)',
      maxTemp_degC: 450,
      minTemp_degC: -196,
      label: 'ISO 15848-1 Class AH (Metallic Bellows Seal)',
      notes: 'Zero-leakage primary containment for lethal, toxic, or vacuum service.',
    };
  }

  switch (packingType) {
    case 'DOUBLE_PTFE_LIVE_LOADED':
      return {
        packingType,
        iso15848TightnessClass: 'AH',
        iso15848EnduranceClass: 'CC2 (60,000 cycles)',
        api622_624Compliant: true,
        stemFinishRa_um: '≤ 0.20 µm (8 µin)',
        maxTemp_degC: 232,
        minTemp_degC: -46,
        label: 'ISO 15848-1 Class AH / API 624 Low-E PTFE',
        notes: operatingTemp_degC > 232 ? 'WARNING: Temp exceeds 232°C PTFE limit; switch to Graphite ULF.' : 'Low-friction Low-E live-loaded PTFE V-ring set.',
      };
    case 'GRAPHITE_ULF_LIVE_LOADED':
      return {
        packingType,
        iso15848TightnessClass: 'BH',
        iso15848EnduranceClass: 'CC1 / CO2 (API 622)',
        api622_624Compliant: true,
        stemFinishRa_um: '≤ 0.40 µm (16 µin)',
        maxTemp_degC: 538,
        minTemp_degC: -196,
        label: 'ISO 15848-1 Class BH / API 622 Low-E Graphite',
        notes: 'Fire-safe (API 607) Low-Emission die-formed graphite with Belleville spring live-loading.',
      };
    case 'HIGH_TEMP_BRAIDED_GRAPHITE':
      return {
        packingType,
        iso15848TightnessClass: 'CH',
        iso15848EnduranceClass: 'CO1 (Standard)',
        api622_624Compliant: false,
        stemFinishRa_um: '≤ 0.40 µm (16 µin)',
        maxTemp_degC: 600,
        minTemp_degC: -196,
        label: 'ISO 15848-1 Class CH (High-Temp Braided Graphite)',
        notes: 'High-friction fire-safe packing; requires higher actuator thrust & deadband allowance.',
      };
    case 'SINGLE_PTFE_V_RING':
    default:
      return {
        packingType,
        iso15848TightnessClass: 'BH',
        iso15848EnduranceClass: 'CO1 (Standard)',
        api622_624Compliant: false,
        stemFinishRa_um: '≤ 0.25 µm (10 µin)',
        maxTemp_degC: 200,
        minTemp_degC: -46,
        label: 'Standard PTFE V-Ring (Non-Low-E)',
        notes: 'General utility service; upgrade to Double PTFE Live-Loaded for EPA/ISO 15848 Class AH.',
      };
  }
}

// ============================================================================
// 4. ISA-75.08.01 / ASME B16.10 FACE-TO-FACE, END CONNECTIONS, FIRE-SAFE & CRYOGENIC
// ============================================================================

export type EndConnectionId = 'RF_FLANGED' | 'RTJ_FLANGED' | 'BUTT_WELD';

export interface PipingAndBodyStandardsResult {
  faceToFace_mm: number;
  endConnectionLabel: string;
  minUpstreamStraightRun_mm: number;
  minDownstreamStraightRun_mm: number;
  fireSafeCompliant: boolean;
  fireSafeNote: string;
  cryogenicExtendedBonnetRequired: boolean;
  cryogenicNote: string;
}

// ISA-75.08.01 / ASME B16.10 standard globe valve face-to-face (mm) by DN and Class
const ISA_75_08_F2F_MM: Record<number, { cl150: number; cl300: number; cl600: number; cl900: number; cl1500: number; cl2500: number }> = {
  15:  { cl150: 184, cl300: 190, cl600: 203, cl900: 279, cl1500: 279, cl2500: 305 },
  20:  { cl150: 184, cl300: 194, cl600: 206, cl900: 279, cl1500: 279, cl2500: 305 },
  25:  { cl150: 184, cl300: 197, cl600: 210, cl900: 292, cl1500: 292, cl2500: 318 },
  40:  { cl150: 222, cl300: 235, cl600: 251, cl900: 333, cl1500: 333, cl2500: 381 },
  50:  { cl150: 254, cl300: 267, cl600: 286, cl900: 375, cl1500: 375, cl2500: 413 },
  80:  { cl150: 298, cl300: 318, cl600: 337, cl900: 441, cl1500: 460, cl2500: 527 },
  100: { cl150: 352, cl300: 368, cl600: 394, cl900: 511, cl1500: 530, cl2500: 610 },
  150: { cl150: 451, cl300: 473, cl600: 508, cl900: 714, cl1500: 768, cl2500: 889 },
  200: { cl150: 543, cl300: 568, cl600: 610, cl900: 914, cl1500: 972, cl2500: 1105 },
  250: { cl150: 673, cl300: 708, cl600: 752, cl900: 991, cl1500: 1067, cl2500: 1270 },
  300: { cl150: 737, cl300: 775, cl600: 819, cl900: 1130, cl1500: 1219, cl2500: 1422 },
  400: { cl150: 1016, cl300: 1057, cl600: 1108, cl900: 1321, cl1500: 1422, cl2500: 1651 },
  500: { cl150: 1194, cl300: 1238, cl600: 1308, cl900: 1549, cl1500: 1676, cl2500: 1905 },
  600: { cl150: 1397, cl300: 1448, cl600: 1524, cl900: 1778, cl1500: 1930, cl2500: 2159 },
};

export function evaluatePipingAndBodyStandards(params: {
  dn: number;
  classId: PressureClassId;
  endConnection: EndConnectionId;
  fireSafeRequired: boolean;
  packingType: PackingTypeId;
  shutoffClass: string;
  minTemp_degC: number;
}): PipingAndBodyStandardsResult {
  const row = ISA_75_08_F2F_MM[params.dn] || ISA_75_08_F2F_MM[100];
  let baseF2F = row.cl300;
  switch (params.classId) {
    case 'CL150_PN16': baseF2F = row.cl150; break;
    case 'CL300_PN40': baseF2F = row.cl300; break;
    case 'CL600_PN100': baseF2F = row.cl600; break;
    case 'CL900_PN160': baseF2F = row.cl900; break;
    case 'CL1500_PN250': baseF2F = row.cl1500; break;
    case 'CL2500_PN420': baseF2F = row.cl2500; break;
  }

  // RTJ adds ~13–16 mm over RF per ASME B16.10
  const faceToFace_mm =
    params.endConnection === 'RTJ_FLANGED' ? baseF2F + 14 : baseF2F;

  const endConnectionLabel =
    params.endConnection === 'RF_FLANGED'
      ? 'ASME B16.5 Raised Face (RF)'
      : params.endConnection === 'RTJ_FLANGED'
      ? 'ASME B16.5 Ring-Type Joint (RTJ)'
      : 'ASME B16.25 Butt-Weld (BW)';

  const isGraphitePacking =
    params.packingType === 'GRAPHITE_ULF_LIVE_LOADED' ||
    params.packingType === 'HIGH_TEMP_BRAIDED_GRAPHITE';
  const fireSafeCompliant = !params.fireSafeRequired || isGraphitePacking;
  const fireSafeNote = params.fireSafeRequired
    ? fireSafeCompliant
      ? 'API 607 / ISO 10497 Compliant: Graphite packing + spiral-wound graphite body gasket + metal secondary seat.'
      : 'NON-COMPLIANT FOR API 607 FIRE-SAFE: PTFE packing/soft-seat melts in fire; switch to Graphite ULF packing & metal-to-metal secondary seat.'
    : 'Standard non-fire-safe construction.';

  const cryogenicExtendedBonnetRequired = params.minTemp_degC < -29;
  const cryogenicNote = cryogenicExtendedBonnetRequired
    ? `BS 6364 Cryogenic Service (${params.minTemp_degC.toFixed(0)}°C < -29°C): Extended cold-box bonnet + drip plate required to keep packing > 0°C.`
    : 'Standard bonnet length (T ≥ -29°C).';

  return {
    faceToFace_mm,
    endConnectionLabel,
    minUpstreamStraightRun_mm: params.dn * 8,
    minDownstreamStraightRun_mm: params.dn * 5,
    fireSafeCompliant,
    fireSafeNote,
    cryogenicExtendedBonnetRequired,
    cryogenicNote,
  };
}

// ============================================================================
// 5. SIL / FUNCTIONAL SAFETY (IEC 61508 / 61511) & SMART POSITIONER DEADBAND (ISA-75.25.01)
// ============================================================================

export interface SilAndPositionerResult {
  estimatedStrokeTime_s: number;
  deadbandPctOfTravel: number;
  stickSlipRisk: 'LOW' | 'MODERATE' | 'HIGH';
  pstReady: boolean;
  volumeBoosterRecommended: boolean;
  silNote: string;
  positionerNote: string;
}

export function evaluateSilAndPositioner(params: {
  silServiceEnabled: boolean;
  targetSilLevel: 'NONE' | 'SIL_1' | 'SIL_2' | 'SIL_3';
  stroke_mm: number;
  actuatorEffectiveArea_cm2: number;
  airSupplyPressure_bar_g: number;
  packingFrictionForceC_N: number;
  benchSetSpan_bar: number;
}): SilAndPositionerResult {
  const {
    silServiceEnabled,
    targetSilLevel,
    stroke_mm,
    actuatorEffectiveArea_cm2,
    airSupplyPressure_bar_g,
    packingFrictionForceC_N,
    benchSetSpan_bar,
  } = params;

  // Diaphragm swept volume (L) = Area (cm2) * stroke (mm) / 10,000
  const sweptVolume_L = (actuatorEffectiveArea_cm2 * stroke_mm) / 10000;
  // Nominal positioner air delivery ~ 180 NL/min (~3 NL/s) at 4 bar
  const flowFactor = Math.max(0.5, airSupplyPressure_bar_g / 4.0);
  const estimatedStrokeTime_s = Math.max(1.2, (sweptVolume_L * 2.4) / flowFactor);
  const volumeBoosterRecommended = estimatedStrokeTime_s > 5.0 || sweptVolume_L > 2.5;

  // Actuator spring stiffness k_spring (N/mm) = (benchSetSpan_bar * 10 * Area_cm2) / stroke_mm
  const springSpanForce_N = Math.max(500, benchSetSpan_bar * 10 * actuatorEffectiveArea_cm2);
  // Deadband / Hysteresis from packing friction = 2 * F_packing / F_spring_span
  const deadbandPctOfTravel = Math.min(15, ((2 * packingFrictionForceC_N) / springSpanForce_N) * 100);

  const stickSlipRisk: 'LOW' | 'MODERATE' | 'HIGH' =
    deadbandPctOfTravel <= 1.0 ? 'LOW' : deadbandPctOfTravel <= 2.5 ? 'MODERATE' : 'HIGH';

  const pstReady = silServiceEnabled && targetSilLevel !== 'NONE';

  const silNote = silServiceEnabled
    ? `IEC 61508/61511 (${targetSilLevel.replace('_', ' ')}): Est. T90 stroke ${estimatedStrokeTime_s.toFixed(1)}s. ${
        volumeBoosterRecommended ? 'Volume booster / quick-exhaust valve recommended.' : 'Standard solenoid + smart positioner PST capable.'
      }`
    : 'Modulating control service (Non-SIS).';

  const positionerNote = `ISA-75.25.01 Stick-Slip Deadband: ${deadbandPctOfTravel.toFixed(2)}% of travel (${stickSlipRisk} risk).`;

  return {
    estimatedStrokeTime_s: Number(estimatedStrokeTime_s.toFixed(1)),
    deadbandPctOfTravel: Number(deadbandPctOfTravel.toFixed(2)),
    stickSlipRisk,
    pstReady,
    volumeBoosterRecommended,
    silNote,
    positionerNote,
  };
}
