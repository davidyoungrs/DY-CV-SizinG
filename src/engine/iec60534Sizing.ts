export type FluidPhase = 'LIQUID' | 'GAS' | 'STEAM';

export interface OperatingPointInput {
  id: string;
  label: string; // e.g., 'Min', 'Normal', 'Max', 'Start-up / Upset'
  enabled: boolean;
  fluidPhase: FluidPhase;
  flowRate: number; // m3/h for Liquid, Nm3/h for Gas, kg/h for Steam
  P1_bar_a: number; // Upstream absolute pressure (bar a)
  P2_bar_a: number; // Downstream absolute pressure (bar a)
  T1_degC: number; // Operating inlet temperature (°C)
  // Liquid properties
  rho_kg_m3: number; // Liquid density (kg/m3), e.g., 998 for water
  Pv_bar_a: number; // Vapor pressure at T1 (bar a)
  Pc_bar_a: number; // Thermodynamic critical pressure (bar a)
  viscosity_cSt: number; // Kinematic viscosity nu (cSt = mm2/s)
  speedOfSound_m_s: number; // Liquid speed of sound c_L (m/s), ~1480 m/s for water
  // Gas / Steam properties
  molecularWeight: number; // M (kg/kmol), e.g., 18.02 steam, 18.5 nat gas, 28.97 air
  gammaCpCv: number; // Specific heat ratio k = Cp/Cv (~1.30–1.40)
  compressibilityZ: number; // Z factor (~0.95–1.0)
}

export interface PipingConfiguration {
  upstreamPipeID_mm: number; // D1 (mm)
  downstreamPipeID_mm: number; // D2 (mm)
  pipeWallThickness_mm: number; // t_p (mm) for acoustic transmission loss
  upstreamPipeLength_m: number; // L_pipe (m) for Joukowsky water-hammer
  actuatorCloseTime_s: number; // Fast-close time t_close (s)
  bodyMaterialCategory: 'CARBON_STEEL' | 'STAINLESS_ALLOY';
}

export type CavitationRegime =
  | 'NON_CAVITATING'
  | 'INCIPIENT_CAVITATION'
  | 'CHOKING_CAVITATION'
  | 'SEVERE_CAVITATION'
  | 'FLASHING'
  | 'COMPRESSIBLE_SUBSONIC'
  | 'COMPRESSIBLE_CHOKED';

export interface CaseSizingResult {
  id: string;
  label: string;
  fluidPhase: FluidPhase;
  deltaP_bar: number;
  deltaP_effective_bar: number;
  deltaP_choked_bar: number;
  isChoked: boolean;
  // Swaged Piping Factors
  FP: number;
  FLP: number;
  xTP: number;
  sigmaK: number;
  // Viscosity Factors
  Rev: number;
  FR: number;
  // Required Flow Coefficients
  requiredCv: number;
  requiredKv: number;
  percentOfRatedCv: number;
  estimatedTravelPct: number;
  // Cavitation & Flashing
  FF: number;
  sigmaCavitation: number; // (P1 - Pv) / dP
  xFZ: number; // Incipient cavitation ratio
  Kc_effective: number;
  regime: CavitationRegime;
  regimeLabel: string;
  regimeSeverity: 'PASS' | 'WARNING' | 'CRITICAL';
  // Velocity, Mach & Water-Hammer
  bodyVelocity_m_s: number;
  bodyVelocityLimit_m_s: number;
  trimExitVelocity_m_s: number;
  outletMach: number;
  outletMachLimit: number;
  pipeMach: number;
  joukowskySurge_bar: number;
  minSafeCloseTime_s: number;
  // Acoustic Noise (IEC 60534-8-3 / 8-4)
  strouhalPeakFreq_Hz: number;
  ringFreq_Hz: number;
  noiseStandardTrim_dBA: number;
  noiseDrilledCage_dBA: number;
  noiseAttenuation_dBA: number;
  noiseStatus: 'PASS' | 'WARNING' | 'CRITICAL';
}

export const FLUID_PRESETS: {
  id: string;
  name: string;
  phase: FluidPhase;
  rho_kg_m3: number;
  Pv_bar_a: number;
  Pc_bar_a: number;
  viscosity_cSt: number;
  speedOfSound_m_s: number;
  molecularWeight: number;
  gammaCpCv: number;
  compressibilityZ: number;
  defaultT1_degC: number;
  notes: string;
}[] = [
  {
    id: 'WATER_20C',
    name: 'Cooling / Process Water (20 °C)',
    phase: 'LIQUID',
    rho_kg_m3: 998.2,
    Pv_bar_a: 0.0234,
    Pc_bar_a: 220.6,
    viscosity_cSt: 1.004,
    speedOfSound_m_s: 1482,
    molecularWeight: 18.015,
    gammaCpCv: 1.33,
    compressibilityZ: 1.0,
    defaultT1_degC: 20,
    notes: 'Standard clean water benchmark per IEC 60534-2-1.',
  },
  {
    id: 'BFW_185C',
    name: 'High-Temp Boiler Feedwater (185 °C)',
    phase: 'LIQUID',
    rho_kg_m3: 881.5,
    Pv_bar_a: 11.23,
    Pc_bar_a: 220.6,
    viscosity_cSt: 0.165,
    speedOfSound_m_s: 1360,
    molecularWeight: 18.015,
    gammaCpCv: 1.32,
    compressibilityZ: 1.0,
    defaultT1_degC: 185,
    notes: 'High vapor pressure BFW prone to severe cavitation/flashing and transient thermal binding.',
  },
  {
    id: 'LIQUID_CHLORINE',
    name: 'Liquid Chlorine (-10 °C, Euro Chlor GEST 17/492)',
    phase: 'LIQUID',
    rho_kg_m3: 1490.0,
    Pv_bar_a: 2.61,
    Pc_bar_a: 79.9,
    viscosity_cSt: 0.28,
    speedOfSound_m_s: 980,
    molecularWeight: 70.9,
    gammaCpCv: 1.35,
    compressibilityZ: 0.96,
    defaultT1_degC: -10,
    notes: 'Lethal service requiring metallic bellows seal bonnet and anti-flashing velocity control.',
  },
  {
    id: 'CRYO_LNG',
    name: 'Cryogenic LNG (-162 °C)',
    phase: 'LIQUID',
    rho_kg_m3: 450.0,
    Pv_bar_a: 1.08,
    Pc_bar_a: 46.0,
    viscosity_cSt: 0.26,
    speedOfSound_m_s: 1320,
    molecularWeight: 16.8,
    gammaCpCv: 1.31,
    compressibilityZ: 0.98,
    defaultT1_degC: -162,
    notes: 'Cryogenic service requiring Cold-Box Extension Bonnet and differential contraction clearance check.',
  },
  {
    id: 'NAT_GAS',
    name: 'Natural Gas / Process Hydrocarbon Gas (45 °C)',
    phase: 'GAS',
    rho_kg_m3: 28.0,
    Pv_bar_a: 0,
    Pc_bar_a: 46.4,
    viscosity_cSt: 0.015,
    speedOfSound_m_s: 430,
    molecularWeight: 18.5,
    gammaCpCv: 1.29,
    compressibilityZ: 0.94,
    defaultT1_degC: 45,
    notes: 'High-pressure gas letdown subject to aerodynamic shock-cell noise and Mach <= 0.30/0.20 limits.',
  },
  {
    id: 'SUPERHEATED_STEAM',
    name: 'High-Pressure Superheated Steam (420 °C)',
    phase: 'STEAM',
    rho_kg_m3: 24.5,
    Pv_bar_a: 0,
    Pc_bar_a: 220.6,
    viscosity_cSt: 0.025,
    speedOfSound_m_s: 625,
    molecularWeight: 18.015,
    gammaCpCv: 1.28,
    compressibilityZ: 0.95,
    defaultT1_degC: 420,
    notes: 'High-temperature steam letdown requiring extended finned bonnet, hardened cage, and thermal lag check.',
  },
];

/**
 * Evaluates IEC 60534 / ISA-75.01 Multi-Condition Sizing, Swaged Piping Corrections (FP, FLP, xTP),
 * Viscosity Correction (FR), 4-Stage Cavitation/Flashing, and IEC 60534-8-3/8-4 Acoustic Noise.
 */
export function evaluateOperatingCase(params: {
  point: OperatingPointInput;
  piping: PipingConfiguration;
  valveD_mm: number;
  seatPort_mm: number;
  ratedCv: number;
  FL: number;
  Kc: number;
  xT: number;
  Fd: number;
  stages: number;
  drilledHoleDia_mm: number; // d_h from cage synthesis (e.g., 3.5 mm)
  characteristicType: string;
  equalPctRangeability: number;
}): CaseSizingResult {
  const {
    point,
    piping,
    valveD_mm,
    seatPort_mm,
    ratedCv,
    FL,
    Kc,
    xT,
    Fd,
    stages,
    drilledHoleDia_mm,
  } = params;

  const d_mm = Math.max(10, valveD_mm);
  const D1_mm = Math.max(d_mm, piping.upstreamPipeID_mm);
  const D2_mm = Math.max(d_mm, piping.downstreamPipeID_mm);

  const P1 = Math.max(0.1, point.P1_bar_a);
  const P2 = Math.max(0.05, Math.min(P1 - 0.01, point.P2_bar_a));
  const deltaP = Math.max(0.01, P1 - P2);
  const T1_K = Math.max(50, point.T1_degC + 273.15);

  // 1. Swaged Piping Resistance Coefficients (IEC 60534-2-1 / Emerson Ch. 5.8.1)
  const d_D1_sq = Math.pow(d_mm / D1_mm, 2);
  const d_D2_sq = Math.pow(d_mm / D2_mm, 2);
  const K1 = 0.5 * Math.pow(1 - d_D1_sq, 2);
  const K2 = 1.0 * Math.pow(1 - d_D2_sq, 2);
  const KB1 = 1 - Math.pow(d_D1_sq, 2);
  const KB2 = 1 - Math.pow(d_D2_sq, 2);
  const sigmaK = Math.max(0, K1 + K2 + KB1 - KB2);
  const K1_plus_KB1 = Math.max(0, K1 + KB1);

  // IEC 60534 numerical constants (with d in mm and Cv):
  // N2 = 0.00214 (for Cv and d in mm), N5 = 0.00241
  const N2_mm = 0.00214;
  const N5_mm = 0.00241;

  // Iterative solution for FP, FLP, xTP using estimated Cv
  let estCv = Math.min(ratedCv, Math.max(0.5, ratedCv * 0.6));
  let FP = 1.0;
  let FLP = FL;
  let xTP = xT;

  for (let iter = 0; iter < 4; iter++) {
    const cv_d2 = estCv / (d_mm * d_mm);
    const cv_d2_sq = cv_d2 * cv_d2;

    FP =
      sigmaK > 1e-5
        ? 1.0 / Math.sqrt(1.0 + (sigmaK / N2_mm) * cv_d2_sq)
        : 1.0;
    FLP =
      K1_plus_KB1 > 1e-5
        ? 1.0 / Math.sqrt((K1_plus_KB1 / N2_mm) * cv_d2_sq + 1.0 / (FL * FL))
        : FL;
    xTP =
      K1_plus_KB1 > 1e-5
        ? (xT / (FP * FP)) * (1.0 / (1.0 + ((xT * K1_plus_KB1) / N5_mm) * cv_d2_sq))
        : xT;

    if (point.fluidPhase === 'LIQUID') {
      const Gf = Math.max(0.1, point.rho_kg_m3 / 999.0);
      const FF =
        0.96 - 0.28 * Math.sqrt(Math.max(0, Math.min(0.99, point.Pv_bar_a / Math.max(1, point.Pc_bar_a))));
      const dP_choked = Math.max(
        0.01,
        Math.pow(FLP / Math.max(0.1, FP), 2) * Math.max(0.01, P1 - FF * point.Pv_bar_a)
      );
      const dP_eff = Math.min(deltaP, dP_choked);
      // N1 = 0.865 for Q in m3/h, dP in bar -> Kv = Q / (N1 * FP * sqrt(dP_eff / Gf)), Cv = Kv / 0.865
      estCv = point.flowRate / (0.865 * 0.865 * FP * Math.sqrt(dP_eff / Gf));
    } else if (point.fluidPhase === 'GAS') {
      const Fgamma = Math.max(0.5, point.gammaCpCv / 1.40);
      const x = deltaP / P1;
      const x_choked = Fgamma * xTP;
      const x_eff = Math.min(x, x_choked);
      const Y = Math.max(0.667, 1.0 - x_eff / (3.0 * x_choked));
      // IEC 60534-2-1 Gas equation: N9 = 2120 (at 0°C, 1.013 bar) -> Cv = Q_Nm3h / (N9 * FP * P1 * Y * sqrt(x_eff / (M * T1_K * Z)))
      // Specifically: Kv = Q_Nm3h / (2120 * FP * P1 * Y * sqrt(x_eff / (M * T1_K * Z))), Cv = 1.156 * Kv
      const denom =
        2120 *
        FP *
        P1 *
        Y *
        Math.sqrt(x_eff / Math.max(1, point.molecularWeight * T1_K * point.compressibilityZ));
      const reqKv = point.flowRate / Math.max(1e-4, denom);
      estCv = reqKv / 0.865;
    } else {
      // STEAM (mass flow W in kg/h): N6 = 27.3 for Kv
      const Fgamma = Math.max(0.5, point.gammaCpCv / 1.40);
      const x = deltaP / P1;
      const x_choked = Fgamma * xTP;
      const x_eff = Math.min(x, x_choked);
      const Y = Math.max(0.667, 1.0 - x_eff / (3.0 * x_choked));
      // Gas law density rho1 = (P1 * 1e5 * M) / (8314.46 * T1_K * Z)
      const rho1 =
        (P1 * 1e5 * point.molecularWeight) /
        Math.max(1, 8314.46 * T1_K * point.compressibilityZ);
      const reqKv =
        point.flowRate / (27.3 * FP * Y * Math.sqrt(Math.max(1e-4, x_eff * P1 * rho1)));
      estCv = reqKv / 0.865;
    }
  }

  // 2. Final Sizing & Viscosity Correction (Re_v & F_R)
  let deltaP_choked = deltaP;
  let deltaP_effective = deltaP;
  let isChoked = false;
  let Rev = 1e6;
  let FR = 1.0;
  let requiredCv = estCv;
  let FF = 0.96;
  let sigmaCavitation = 9.99;
  let xFZ = 0.5;
  let Kc_effective = Kc;
  let regime: CavitationRegime = 'NON_CAVITATING';
  let regimeLabel = 'Clean Single-Phase Flow';
  let regimeSeverity: 'PASS' | 'WARNING' | 'CRITICAL' = 'PASS';

  if (point.fluidPhase === 'LIQUID') {
    const Gf = Math.max(0.1, point.rho_kg_m3 / 999.0);
    FF =
      0.96 -
      0.28 *
        Math.sqrt(
          Math.max(0, Math.min(0.99, point.Pv_bar_a / Math.max(1, point.Pc_bar_a)))
        );
    deltaP_choked = Math.max(
      0.01,
      Math.pow(FLP / Math.max(0.1, FP), 2) * Math.max(0.01, P1 - FF * point.Pv_bar_a)
    );
    isChoked = deltaP >= deltaP_choked;
    deltaP_effective = Math.min(deltaP, deltaP_choked);

    // Turbulent Cv
    const cvTurbulent =
      point.flowRate / (0.865 * 0.865 * FP * Math.sqrt(deltaP_effective / Gf));

    // Valve Reynolds Number Re_v per IEC 60534-2-1 (N4 = 70700 for Q in m3/h, nu in cSt)
    const nu = Math.max(0.05, point.viscosity_cSt);
    const termFourth =
      1 + Math.pow((FL * FL * cvTurbulent * cvTurbulent) / (N2_mm * Math.pow(d_mm, 4)), 2);
    Rev =
      ((70700 * Fd * point.flowRate) / (nu * Math.sqrt(FL * Math.max(0.01, cvTurbulent)))) *
      Math.pow(termFourth, 0.25);

    if (Rev < 10000) {
      // Smooth transition curve from laminar/transitional to turbulent per IEC 60534-2-1
      const logRe = Math.log10(Math.max(1, Rev));
      FR = Math.min(1.0, Math.max(0.18, 0.026 * Math.pow(logRe, 3.85)));
    } else {
      FR = 1.0;
    }

    requiredCv = cvTurbulent / FR;

    // Cavitation & Flashing Classification (Emerson Ch. 6 & Skousen Ch. 9)
    sigmaCavitation = (P1 - point.Pv_bar_a) / Math.max(0.01, deltaP);
    // Incipient cavitation factor xFZ per IEC 60534-8-4 (~ 0.9 / sqrt(1 + 3.2 * Fd * sqrt(Cv / FL)))
    xFZ = Math.min(
      Kc * 0.92,
      Math.max(
        0.18,
        0.9 / Math.sqrt(1 + 2.5 * Fd * Math.sqrt(Math.max(1, requiredCv) / FL))
      )
    );
    // Multi-stage trims multiply effective cavitation resistance
    const stageMultiplier = stages === 1 ? 1.0 : stages === 2 ? 1.65 : 2.35;
    xFZ = Math.min(0.96, xFZ * Math.pow(stageMultiplier, 0.35));
    Kc_effective = Math.min(0.98, 1 - (1 - Kc) / stageMultiplier);

    const dP_ratio = deltaP / Math.max(0.01, P1 - point.Pv_bar_a);

    if (P2 <= point.Pv_bar_a) {
      regime = 'FLASHING';
      regimeLabel = 'Flashing Two-Phase Flow (P2 ≤ Pv)';
      regimeSeverity = 'CRITICAL';
    } else if (deltaP >= deltaP_choked * stageMultiplier || sigmaCavitation < 0.45 / stageMultiplier) {
      regime = 'SEVERE_CAVITATION';
      regimeLabel = 'Severe / Destructive Choked Cavitation';
      regimeSeverity = 'CRITICAL';
    } else if (dP_ratio >= Kc_effective) {
      regime = 'CHOKING_CAVITATION';
      regimeLabel = 'Constant / Choking Cavitation (ΔP ≥ Kc·(P1-Pv))';
      regimeSeverity = stages >= 1 ? 'WARNING' : 'CRITICAL';
    } else if (dP_ratio >= xFZ) {
      regime = 'INCIPIENT_CAVITATION';
      regimeLabel = 'Incipient Cavitation (Micro-Bubble Onset)';
      regimeSeverity = 'WARNING';
    } else {
      regime = 'NON_CAVITATING';
      regimeLabel = 'Non-Cavitating Liquid Service';
      regimeSeverity = 'PASS';
    }
  } else {
    // GAS or STEAM
    const Fgamma = Math.max(0.5, point.gammaCpCv / 1.40);
    const x = deltaP / P1;
    const x_choked = Fgamma * xTP;
    isChoked = x >= x_choked;
    const x_eff = Math.min(x, x_choked);
    deltaP_choked = x_choked * P1;
    deltaP_effective = x_eff * P1;
    requiredCv = estCv;
    regime = isChoked ? 'COMPRESSIBLE_CHOKED' : 'COMPRESSIBLE_SUBSONIC';
    regimeLabel = isChoked
      ? 'Choked / Sonic Vena Contracta (x ≥ Fγ·xTP)'
      : 'Subsonic Compressible Expansion';
    regimeSeverity = isChoked ? 'WARNING' : 'PASS';
  }

  const requiredKv = 0.865 * requiredCv;
  const percentOfRatedCv = (requiredCv / Math.max(0.01, ratedCv)) * 100;

  // Estimate Travel % from Characteristic
  const normPhi = Math.min(1.0, Math.max(0.005, requiredCv / Math.max(0.01, ratedCv)));
  let estimatedTravelPct = normPhi * 100;
  if (params.characteristicType === 'EQUAL_PCT') {
    const R = Math.max(20, params.equalPctRangeability || 50);
    estimatedTravelPct = Math.max(0, Math.min(100, (1 + Math.log(normPhi) / Math.log(R)) * 100));
  } else if (params.characteristicType === 'QUICK_OPENING') {
    estimatedTravelPct = Math.pow(normPhi, 2) * 100;
  } else if (params.characteristicType === 'MODIFIED_PARABOLIC') {
    estimatedTravelPct = Math.pow(normPhi, 1 / 1.65) * 100;
  }

  // 3. Velocity, Mach & Joukowsky Water-Hammer Checks
  const bodyArea_m2 = (Math.PI / 4) * Math.pow(d_mm / 1000, 2);
  const pipeDownArea_m2 = (Math.PI / 4) * Math.pow(D2_mm / 1000, 2);
  const trimCurtainArea_m2 = Math.max(
    1e-6,
    (requiredCv / 38.0) * 0.00064516 // Effective orifice area in m2
  );

  let bodyVelocity_m_s = 0;
  let bodyVelocityLimit_m_s =
    piping.bodyMaterialCategory === 'STAINLESS_ALLOY' ? 15.0 : 10.5;
  let trimExitVelocity_m_s = 0;
  let outletMach = 0;
  const outletMachLimit = stages >= 1 ? 0.20 : 0.30; // IEC 60534-8-3 Clause 7 low-noise vs std
  let pipeMach = 0;
  let joukowskySurge_bar = 0;
  let minSafeCloseTime_s = 1.0;

  if (point.fluidPhase === 'LIQUID') {
    const Q_m3_s = point.flowRate / 3600;
    bodyVelocity_m_s = Q_m3_s / bodyArea_m2;
    trimExitVelocity_m_s = Math.sqrt((2 * deltaP_effective * 1e5) / Math.max(100, point.rho_kg_m3));
    const cL = Math.max(500, point.speedOfSound_m_s);
    outletMach = bodyVelocity_m_s / cL;
    pipeMach = (Q_m3_s / pipeDownArea_m2) / cL;

    // Joukowsky Water-Hammer (Skousen Ch. 9): dP_surge = rho * c_L * dv
    const pipeVel_m_s = Q_m3_s / pipeDownArea_m2;
    const acousticReflectionTime_s = (2 * Math.max(10, piping.upstreamPipeLength_m)) / cL;
    minSafeCloseTime_s = Number((acousticReflectionTime_s * 5.0).toFixed(2));
    const effectiveShutoffFactor =
      piping.actuatorCloseTime_s <= acousticReflectionTime_s
        ? 1.0
        : acousticReflectionTime_s / piping.actuatorCloseTime_s;
    joukowskySurge_bar =
      (point.rho_kg_m3 * cL * pipeVel_m_s * effectiveShutoffFactor) / 1e5;
  } else {
    // Compressible mass flow rate m_dot (kg/s)
    const rhoStd = point.molecularWeight / 22.414;
    const m_dot_kg_s =
      point.fluidPhase === 'GAS'
        ? (point.flowRate * rhoStd) / 3600
        : point.flowRate / 3600;

    const R_specific = 8314.46 / Math.max(2, point.molecularWeight);
    const sonicSpeed_m_s = Math.sqrt(
      point.gammaCpCv * R_specific * T1_K * point.compressibilityZ
    );
    const rhoDownstream =
      (P2 * 1e5) / Math.max(1, R_specific * T1_K * point.compressibilityZ);

    const Q_actual_down_m3_s = m_dot_kg_s / Math.max(0.05, rhoDownstream);
    bodyVelocity_m_s = Q_actual_down_m3_s / bodyArea_m2;
    const pipeVelDown_m_s = Q_actual_down_m3_s / pipeDownArea_m2;
    outletMach = bodyVelocity_m_s / sonicSpeed_m_s;
    pipeMach = pipeVelDown_m_s / sonicSpeed_m_s;
    trimExitVelocity_m_s = Math.min(
      sonicSpeed_m_s,
      Q_actual_down_m3_s / Math.max(1e-5, trimCurtainArea_m2)
    );
    bodyVelocityLimit_m_s = outletMachLimit * sonicSpeed_m_s;
  }

  // 4. IEC 60534-8-3 (Aerodynamic) & IEC 60534-8-4 (Hydrodynamic) Acoustic Noise Prediction
  // Ring frequency of steel pipe: f_r = c_steel / (pi * D2) where c_steel ~ 5050 m/s
  const ringFreq_Hz = Math.round(5050 / (Math.PI * (D2_mm / 1000)));
  const dH_std_m = Math.max(0.008, (seatPort_mm * 0.45) / 1000); // Single contoured port hydraulic dia
  const dH_drilled_m = Math.max(0.0015, drilledHoleDia_mm / 1000); // Single drilled cage hole dia

  const U_vc = Math.max(5, trimExitVelocity_m_s);
  const strouhalPeakFreq_Hz = Math.round((0.2 * U_vc) / dH_drilled_m);
  const strouhalStdFreq_Hz = Math.round((0.2 * U_vc) / dH_std_m);

  let noiseStandardTrim_dBA = 55;
  let noiseDrilledCage_dBA = 48;

  if (point.fluidPhase === 'LIQUID') {
    const Q_m3_s = point.flowRate / 3600;
    // Mechanical stream power W_m = Q * dP
    const Wm_watts = Math.max(1, point.rho_kg_m3 * Q_m3_s * (deltaP * 1e5) / point.rho_kg_m3);
    // Acoustic efficiency eta_turb ~ 1e-8, eta_cav ~ 1e-4
    let eta = 1.2e-8 * Math.pow(deltaP / Math.max(0.1, FL), 1.5);
    if (regime === 'INCIPIENT_CAVITATION') eta *= 18;
    if (regime === 'CHOKING_CAVITATION') eta *= 160;
    if (regime === 'SEVERE_CAVITATION' || regime === 'FLASHING') eta *= 650;

    const Wa_std = Wm_watts * eta;
    const t_p_m = Math.max(0.003, piping.pipeWallThickness_mm / 1000);
    // Pipe Transmission Loss TL
    const TL_std = 36 + 10 * Math.log10((t_p_m * 1000) / Math.max(15, D2_mm));
    noiseStandardTrim_dBA = Math.min(
      118,
      Math.max(42, 10 * Math.log10(Math.max(1e-12, Wa_std) / 1e-12) - TL_std - 8)
    );

    // Multi-hole drilled cage splits jet power and suppresses cavitation / shifts frequency
    const freqShiftGain_dB =
      4.5 * Math.log10(Math.max(1, strouhalPeakFreq_Hz / Math.max(100, strouhalStdFreq_Hz)));
    const stageGain_dB = (stages - 1) * 7.5 + (stages >= 1 ? 6.5 : 0);
    noiseDrilledCage_dBA = Math.max(
      40,
      noiseStandardTrim_dBA - freqShiftGain_dB - stageGain_dB
    );
  } else {
    // Aerodynamic Noise (IEC 60534-8-3)
    const rhoStd = point.molecularWeight / 22.414;
    const m_dot_kg_s =
      point.fluidPhase === 'GAS'
        ? (point.flowRate * rhoStd) / 3600
        : point.flowRate / 3600;
    const Wm_watts = Math.max(1, 0.5 * m_dot_kg_s * U_vc * U_vc);
    const x_ratio = deltaP / P1;
    const machJet = Math.min(2.2, Math.sqrt((2 / (point.gammaCpCv - 1)) * (Math.pow(P1 / P2, (point.gammaCpCv - 1) / point.gammaCpCv) - 1)));
    const eta_aero = Math.min(0.01, 1.4e-4 * Math.pow(Math.max(0.2, machJet), 3.6) * x_ratio);
    const Wa_std = Wm_watts * eta_aero;

    const t_p_m = Math.max(0.003, piping.pipeWallThickness_mm / 1000);
    const TL_base = 42 + 12 * Math.log10((t_p_m * 1000) / Math.max(15, D2_mm));
    noiseStandardTrim_dBA = Math.min(
      125,
      Math.max(45, 10 * Math.log10(Math.max(1e-12, Wa_std) / 1e-12) - TL_base)
    );

    // Drilled cage ultrasonic frequency shift + multi-stage pressure staging attenuation
    // Per IEC 60534-8-3: shifting f_p above f_r increases A-weighted pipe wall attenuation by 10*log10((d_std/d_hole)^1.5)
    const holeFreqGain_dB =
      11.5 * Math.log10(Math.max(1, dH_std_m / dH_drilled_m));
    const stageLetdownGain_dB = (stages - 1) * 8.5;
    // Secondary outlet Mach penalty if M_outlet > 0.25
    const machOutletPenalty_dB =
      outletMach > 0.22 ? 18 * Math.log10(outletMach / 0.22) : 0;

    noiseDrilledCage_dBA = Math.max(
      42,
      noiseStandardTrim_dBA - holeFreqGain_dB - stageLetdownGain_dB + machOutletPenalty_dB
    );
  }

  const noiseAttenuation_dBA = Math.max(0, noiseStandardTrim_dBA - noiseDrilledCage_dBA);
  const noiseStatus: 'PASS' | 'WARNING' | 'CRITICAL' =
    noiseDrilledCage_dBA <= 82
      ? 'PASS'
      : noiseDrilledCage_dBA <= 85
      ? 'WARNING'
      : 'CRITICAL';

  return {
    id: point.id,
    label: point.label,
    fluidPhase: point.fluidPhase,
    deltaP_bar: Number(deltaP.toFixed(2)),
    deltaP_effective_bar: Number(deltaP_effective.toFixed(2)),
    deltaP_choked_bar: Number(deltaP_choked.toFixed(2)),
    isChoked,
    FP: Number(FP.toFixed(3)),
    FLP: Number(FLP.toFixed(3)),
    xTP: Number(xTP.toFixed(3)),
    sigmaK: Number(sigmaK.toFixed(3)),
    Rev: Math.round(Rev),
    FR: Number(FR.toFixed(3)),
    requiredCv: Number(requiredCv.toFixed(2)),
    requiredKv: Number(requiredKv.toFixed(2)),
    percentOfRatedCv: Number(percentOfRatedCv.toFixed(1)),
    estimatedTravelPct: Number(estimatedTravelPct.toFixed(1)),
    FF: Number(FF.toFixed(3)),
    sigmaCavitation: Number(sigmaCavitation.toFixed(2)),
    xFZ: Number(xFZ.toFixed(2)),
    Kc_effective: Number(Kc_effective.toFixed(2)),
    regime,
    regimeLabel,
    regimeSeverity,
    bodyVelocity_m_s: Number(bodyVelocity_m_s.toFixed(2)),
    bodyVelocityLimit_m_s: Number(bodyVelocityLimit_m_s.toFixed(1)),
    trimExitVelocity_m_s: Number(trimExitVelocity_m_s.toFixed(1)),
    outletMach: Number(outletMach.toFixed(3)),
    outletMachLimit,
    pipeMach: Number(pipeMach.toFixed(3)),
    joukowskySurge_bar: Number(joukowskySurge_bar.toFixed(2)),
    minSafeCloseTime_s,
    strouhalPeakFreq_Hz,
    ringFreq_Hz,
    noiseStandardTrim_dBA: Number(noiseStandardTrim_dBA.toFixed(1)),
    noiseDrilledCage_dBA: Number(noiseDrilledCage_dBA.toFixed(1)),
    noiseAttenuation_dBA: Number(noiseAttenuation_dBA.toFixed(1)),
    noiseStatus,
  };
}
