export type CharacteristicTypeId =
  | 'LINEAR'
  | 'EQUAL_PCT'
  | 'MODIFIED_EQUAL_PCT'
  | 'BI_LINEAR'
  | 'QUICK_OPENING'
  | 'MODIFIED_PARABOLIC'
  | 'CUSTOM_SPLINE'
  | 'AUTO_FIT_CONSTANT_GAIN';

export interface CustomSplineControlPoint {
  travelPct: number; // 0 to 100
  cvPct: number; // 0 to 100
}

export interface CharacteristicConfig {
  type: CharacteristicTypeId;
  equalPctRangeability: number; // R = 30, 50, 100
  biLinearKneeTravelPct: number; // e.g., 30%
  biLinearKneeCvPct: number; // e.g., 10%
  valveAuthorityPv: number; // Pv = dP_v(100%) / dP_sys (0.05 to 1.0)
  customPoints: CustomSplineControlPoint[];
}

export interface CharacteristicCurvePoint {
  travelPct: number; // 0 to 100
  travel_mm: number;
  inherentPhi: number; // 0 to 1
  inherentCv: number;
  installedFlowPct: number; // 0 to 100
  inherentGain: number; // d(phi)/d(h)
  installedGain: number; // d(Q/Qmax)/d(h)
  inStabilityBand: boolean; // 0.5 <= G_installed <= 2.0
  systemDeltaP_bar: number;
}

export interface CharacteristicSimulationSummary {
  points: CharacteristicCurvePoint[];
  minInstalledGainWorkingSpan: number; // 15% - 85% travel
  maxInstalledGainWorkingSpan: number;
  gainRatioWorkingSpan: number;
  stabilityBandCoveragePct: number; // % of 15-85% travel within [0.5, 2.0]
  recommendedCharacteristicNote: string;
  trueMinControllableCv: number; // Warren Table 1: Cv_rated / R (50 for Eq-%, 30 for Linear)
  nelesInstalledMaxFlowPctOfMax: number; // Neles: % of installed max system flow delivered at operating max Cv
  nelesInstalledHeadroomPct: number; // Neles: remaining installed flow headroom (100 - maxFlow%)
  nelesSafetyFactorTrapWarning: boolean; // True when inherent phi <= 88% yet installed headroom < 10%
  peakDeadbandFlowSwingPct: number; // Flow excursion (%) per 1% valve stiction / deadband at max working gain
}

/**
 * Monotonic Fritsch-Carlson PCHIP interpolation for custom control points
 */
export function evaluateMonotonicPchip(
  controlPoints: CustomSplineControlPoint[],
  targetTravelPct: number
): number {
  const sorted = [...controlPoints]
    .map((p) => ({
      x: Math.max(0, Math.min(100, p.travelPct)),
      y: Math.max(0, Math.min(100, p.cvPct)),
    }))
    .sort((a, b) => a.x - b.x);

  if (sorted.length === 0) return targetTravelPct;
  if (targetTravelPct <= sorted[0].x) return sorted[0].y;
  if (targetTravelPct >= sorted[sorted.length - 1].x) return sorted[sorted.length - 1].y;

  const n = sorted.length;
  const dx: number[] = [];
  const dy: number[] = [];
  const slopes: number[] = [];

  for (let i = 0; i < n - 1; i++) {
    const h = Math.max(1e-4, sorted[i + 1].x - sorted[i].x);
    const d = Math.max(0, sorted[i + 1].y - sorted[i].y);
    dx.push(h);
    dy.push(d);
    slopes.push(d / h);
  }

  const m: number[] = new Array(n).fill(0);
  m[0] = slopes[0];
  m[n - 1] = slopes[n - 2];

  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      m[i] = 0;
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      m[i] = (w1 + w2) / (w1 / slopes[i - 1] + w2 / slopes[i]);
    }
  }

  let seg = 0;
  for (let i = 0; i < n - 1; i++) {
    if (targetTravelPct >= sorted[i].x && targetTravelPct <= sorted[i + 1].x) {
      seg = i;
      break;
    }
  }

  const h = dx[seg];
  const t = (targetTravelPct - sorted[seg].x) / h;
  const t2 = t * t;
  const t3 = t2 * t;

  const h00 = 2 * t3 - 3 * t2 + 1;
  const h10 = t3 - 2 * t2 + t;
  const h01 = -2 * t3 + 3 * t2;
  const h11 = t3 - t2;

  const y =
    h00 * sorted[seg].y +
    h10 * h * m[seg] +
    h01 * sorted[seg + 1].y +
    h11 * h * m[seg + 1];

  return Math.max(0, Math.min(100, y));
}

/**
 * Evaluates normalized inherent flow capacity phi(h) in [0, 1] for normalized travel h in [0, 1]
 */
export function evaluateInherentPhi(
  h: number,
  config: CharacteristicConfig
): number {
  const hClamped = Math.max(0, Math.min(1, h));
  if (hClamped <= 0) return 0;
  if (hClamped >= 1) return 1;

  const R = Math.max(15, config.equalPctRangeability || 50);

  switch (config.type) {
    case 'LINEAR':
      return hClamped;

    case 'EQUAL_PCT': {
      const raw = Math.pow(R, hClamped - 1);
      const raw0 = 1 / R;
      return Math.max(0, Math.min(1, (raw - raw0) / (1 - raw0)));
    }

    case 'MODIFIED_EQUAL_PCT': {
      const eqp = (Math.pow(R, hClamped - 1) - 1 / R) / (1 - 1 / R);
      return Math.max(0, Math.min(1, 0.78 * eqp + 0.22 * Math.pow(hClamped, 1.35)));
    }

    case 'BI_LINEAR': {
      const hKnee = Math.max(0.05, Math.min(0.95, config.biLinearKneeTravelPct / 100));
      const phiKnee = Math.max(0.01, Math.min(0.95, config.biLinearKneeCvPct / 100));
      if (hClamped <= hKnee) {
        return (hClamped / hKnee) * phiKnee;
      }
      return phiKnee + ((hClamped - hKnee) / (1 - hKnee)) * (1 - phiKnee);
    }

    case 'QUICK_OPENING':
      return Math.pow(hClamped, 0.45);

    case 'MODIFIED_PARABOLIC':
      return Math.pow(hClamped, 1.75);

    case 'CUSTOM_SPLINE':
      return evaluateMonotonicPchip(config.customPoints, hClamped * 100) / 100;

    case 'AUTO_FIT_CONSTANT_GAIN': {
      // Inverse of Installed Characteristic so Q_installed(h)/Q_max = h (Constant Installed Gain = 1.0)
      const Pv = Math.max(0.05, Math.min(0.98, config.valveAuthorityPv));
      const num = 1 - Pv;
      const den = Math.max(1e-4, 1 - Pv * hClamped * hClamped);
      return Math.max(0, Math.min(1, hClamped * Math.sqrt(num / den)));
    }

    default:
      return hClamped;
  }
}

/**
 * Simulates Inherent & Installed Flow Characteristics, Gain Curves, and EnTec Stability Compliance
 */
export function simulateCharacteristicCurves(params: {
  config: CharacteristicConfig;
  ratedCv: number;
  stroke_mm: number;
  maxSystemDeltaP_bar: number;
  maxOperatingRequiredCv?: number;
  minOperatingRequiredCv?: number;
}): CharacteristicSimulationSummary {
  const { config, ratedCv, stroke_mm, maxSystemDeltaP_bar } = params;
  const Pv = Math.max(0.03, Math.min(1.0, config.valveAuthorityPv));
  const numSteps = 100;
  const points: CharacteristicCurvePoint[] = [];

  for (let i = 0; i <= numSteps; i++) {
    const travelPct = i;
    const h = i / numSteps;
    const phi = evaluateInherentPhi(h, config);

    const installedFrac =
      phi / Math.sqrt(Math.max(1e-6, Pv * phi * phi + (1 - Pv)));

    const dh = 0.005;
    const hMinus = Math.max(0, h - dh);
    const hPlus = Math.min(1, h + dh);
    const actualDh = Math.max(1e-4, hPlus - hMinus);

    const phiMinus = evaluateInherentPhi(hMinus, config);
    const phiPlus = evaluateInherentPhi(hPlus, config);
    const inherentGain = (phiPlus - phiMinus) / actualDh;

    const instMinus =
      phiMinus / Math.sqrt(Math.max(1e-6, Pv * phiMinus * phiMinus + (1 - Pv)));
    const instPlus =
      phiPlus / Math.sqrt(Math.max(1e-6, Pv * phiPlus * phiPlus + (1 - Pv)));
    const installedGain = (instPlus - instMinus) / actualDh;

    const inStabilityBand = installedGain >= 0.5 && installedGain <= 2.0;
    const valveDropFrac = (1 - Pv) + Pv * (1 - installedFrac * installedFrac);
    const systemDeltaP_bar = maxSystemDeltaP_bar * valveDropFrac;

    points.push({
      travelPct,
      travel_mm: Number((h * stroke_mm).toFixed(2)),
      inherentPhi: Number(phi.toFixed(4)),
      inherentCv: Number((phi * ratedCv).toFixed(2)),
      installedFlowPct: Number((installedFrac * 100).toFixed(2)),
      inherentGain: Number(inherentGain.toFixed(2)),
      installedGain: Number(installedGain.toFixed(2)),
      inStabilityBand,
      systemDeltaP_bar: Number(systemDeltaP_bar.toFixed(2)),
    });
  }

  const workingPoints = points.filter((p) => p.travelPct >= 15 && p.travelPct <= 85);
  const gains = workingPoints.map((p) => p.installedGain);
  const minInstalledGainWorkingSpan = Number(Math.min(...gains).toFixed(2));
  const maxInstalledGainWorkingSpan = Number(Math.max(...gains).toFixed(2));
  const gainRatioWorkingSpan = Number(
    (maxInstalledGainWorkingSpan / Math.max(0.05, minInstalledGainWorkingSpan)).toFixed(2)
  );
  const stableCount = workingPoints.filter((p) => p.inStabilityBand).length;
  const stabilityBandCoveragePct = Math.round(
    (stableCount / Math.max(1, workingPoints.length)) * 100
  );

  const { maxOperatingRequiredCv, minOperatingRequiredCv } = params;
  const effectiveRangeability =
    config.type === 'EQUAL_PCT' || config.type === 'MODIFIED_EQUAL_PCT'
      ? Math.max(20, config.equalPctRangeability || 50)
      : 30;
  const trueMinControllableCv = Number((ratedCv / effectiveRangeability).toFixed(2));

  const phiMaxOp = Math.min(
    1,
    Math.max(0.01, (maxOperatingRequiredCv ?? ratedCv * 0.75) / Math.max(0.01, ratedCv))
  );
  const instMaxFrac = phiMaxOp / Math.sqrt(Math.max(1e-6, Pv + (1 - Pv) * phiMaxOp * phiMaxOp));
  const nelesInstalledMaxFlowPctOfMax = Number((instMaxFrac * 100).toFixed(1));
  const nelesInstalledHeadroomPct = Number(Math.max(0, 100 - nelesInstalledMaxFlowPctOfMax).toFixed(1));
  const nelesSafetyFactorTrapWarning = phiMaxOp <= 0.88 && nelesInstalledHeadroomPct < 10;
  const peakDeadbandFlowSwingPct = Number((maxInstalledGainWorkingSpan * 1.0).toFixed(2));

  let recommendedCharacteristicNote = '';
  if (Pv < 0.25 && config.type === 'LINEAR') {
    recommendedCharacteristicNote = `Low Valve Authority (Pv = ${Pv.toFixed(2)}): Linear trim suffers severe upper-travel gain drop-off. Switch to Equal-% or Auto-Fit Constant Gain.`;
  } else if (Pv > 0.65 && config.type === 'EQUAL_PCT') {
    recommendedCharacteristicNote = `High Valve Authority (Pv = ${Pv.toFixed(2)}): Equal-% trim produces high gain at upper travel. Consider Linear or Modified Parabolic.`;
  } else if (stabilityBandCoveragePct >= 85) {
    recommendedCharacteristicNote = `Excellent Loop Stability: ${stabilityBandCoveragePct}% of working travel (15–85%) remains inside the EnTec [0.5, 2.0] Installed Gain band.`;
  } else {
    recommendedCharacteristicNote = `Partial Gain Excursion (${stabilityBandCoveragePct}% in [0.5, 2.0] band). Use "Auto-Fit Constant Installed Gain" or adjust custom spline points.`;
  }

  if (nelesSafetyFactorTrapWarning) {
    recommendedCharacteristicNote += ` Installed Authority Alert: Inherent utilization is ${(phiMaxOp * 100).toFixed(0)}%, yet installed headroom is only ${nelesInstalledHeadroomPct}% at Pv = ${Pv.toFixed(2)}.`;
  }
  if (minOperatingRequiredCv !== undefined && minOperatingRequiredCv < trueMinControllableCv) {
    recommendedCharacteristicNote += ` Rangeability Alert: Min required Cv (${minOperatingRequiredCv.toFixed(2)}) is below true controllable floor Cv_rated/${effectiveRangeability} (${trueMinControllableCv}).`;
  }

  return {
    points,
    minInstalledGainWorkingSpan,
    maxInstalledGainWorkingSpan,
    gainRatioWorkingSpan,
    stabilityBandCoveragePct,
    recommendedCharacteristicNote,
    trueMinControllableCv,
    nelesInstalledMaxFlowPctOfMax,
    nelesInstalledHeadroomPct,
    nelesSafetyFactorTrapWarning,
    peakDeadbandFlowSwingPct,
  };
}
