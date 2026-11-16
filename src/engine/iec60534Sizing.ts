import { evaluateStrokeDependentRecovery } from './valveSchedule.ts';
import type { FlowDirectionId } from './valveSchedule.ts';

export type FluidPhase = 'LIQUID' | 'GAS' | 'STEAM' | 'TWO_PHASE';

export interface OperatingPointInput {
  id: string;
  label: string; // e.g., 'Min', 'Normal', 'Max', 'Start-up / Upset'
  enabled: boolean;
  fluidPhase: FluidPhase;
  flowRate: number; // m3/h for Liquid, Nm3/h for Gas, kg/h for Steam / Two-Phase
  P1_bar_a: number; // Upstream absolute pressure (bar a)
  P2_bar_a: number; // Downstream absolute pressure (bar a)
  T1_degC: number; // Operating inlet temperature (°C)
  // Liquid properties
  rho_kg_m3: number; // Liquid density (kg/m3), e.g., 998 for water
  Pv_bar_a: number; // Vapor pressure at T1 (bar a)
  Pc_bar_a: number; // Thermodynamic critical pressure (bar a)
  viscosity_cSt: number; // Kinematic viscosity nu (cSt = mm2/s)
  speedOfSound_m_s: number; // Liquid speed of sound c_L (m/s), ~1480 m/s for water
  // Gas / Steam / Two-Phase properties
  molecularWeight: number; // M (kg/kmol), e.g., 18.02 steam, 18.5 nat gas, 28.97 air
  gammaCpCv: number; // Specific heat ratio k = Cp/Cv (~1.30–1.40)
  compressibilityZ: number; // Z factor (~0.95–1.0)
  massFractionGas_fg?: number; // Two-Phase gas/vapor mass fraction fg (0.01 to 0.99)
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
  | 'COMPRESSIBLE_CHOKED'
  | 'TWO_PHASE_SEPARATED'
  | 'TWO_PHASE_HOMOGENEOUS';

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
  // Stroke-dependent & Required Recovery Factors (Parcol Fig. 6, Warren Table 3)
  FL_effectiveAtTravel: number;
  xT_effectiveAtTravel: number;
  FL_required: number;
  // Viscosity Factors
  Rev: number;
  FR: number;
  // Required Flow Coefficients
  requiredCv: number;
  requiredKv: number;
  percentOfRatedCv: number;
  estimatedTravelPct: number;
  // Steam / Multistage / Two-Phase Extensions (Masoneilan GEA19540A & Parcol §4.3)
  steamSuperheat_degC: number;
  steamSuperheatFactorFSH: number;
  multistageFactorFM: number;
  twoPhaseModelUsed: string;
  // Cavitation & Flashing + ISA-RP75.23 Multi-Regime Sigma
  FF: number;
  sigmaCavitation: number; // (P1 - Pv) / dP
  sigmaIncipient_i: number;
  sigmaConstant_c: number;
  sigmaRecommended_mr: number;
  sigmaMaxVibration_mv: number;
  materialCavitationIndex: number;
  xFZ: number; // Incipient cavitation ratio
  Kc_effective: number;
  regime: CavitationRegime;
  regimeLabel: string;
  regimeSeverity: 'PASS' | 'WARNING' | 'CRITICAL';
  // Velocity, Mach, Water-Hammer & Thiruvengadam Endurance Check
  bodyVelocity_m_s: number;
  bodyVelocityLimit_m_s: number;
  trimExitVelocity_m_s: number;
  venaContractaVelocity_m_s: number;
  trimKineticEnergy_kPa: number;
  trimKineticEnergy_psi: number;
  outletMach: number;
  outletMachLimit: number;
  pipeMach: number;
  joukowskySurge_bar: number;
  minSafeCloseTime_s: number;
  waterHammerSurfacePressure_MPa: number;
  thiruvengadamEnduranceLimit_MPa: number;
  thiruvengadamErosionRatioPct: number;
  // API RP 14E Erosional Velocity & Expanded Outlet Check
  erosionalVelocity_m_s: number;
  erosionalVelocityRatio: number;
  expandedOutletRecommended: boolean;
  // Acoustic Noise (IEC 60534-8-3 / 8-4 + Masoneilan Expander Noise + Pulsation + OSHA/NIOSH)
  strouhalPeakFreq_Hz: number;
  ringFreq_Hz: number;
  coincidenceFreq_Hz: number;
  expanderNoise_dBA: number;
  noiseStandardTrim_dBA: number;
  noiseDrilledCage_dBA: number;
  noiseAttenuation_dBA: number;
  noiseStatus: 'PASS' | 'WARNING' | 'CRITICAL';
  strokeToPortAspectRatio: number;
  lowFreqPulsationRisk: boolean;
  oshaNioshExposureSummary: string;
}

export interface FluidPresetSpec {
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
  massFractionGas_fg?: number;
  defaultT1_degC: number;
  notes: string;
}

export const FLUID_PRESETS: FluidPresetSpec[] = [
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
  {
    id: 'SATURATED_STEAM_12BAR',
    name: 'Saturated Process Steam (~12 bar / 190 °C)',
    phase: 'STEAM',
    rho_kg_m3: 6.1,
    Pv_bar_a: 0,
    Pc_bar_a: 220.6,
    viscosity_cSt: 0.016,
    speedOfSound_m_s: 505,
    molecularWeight: 18.015,
    gammaCpCv: 1.31,
    compressibilityZ: 0.92,
    defaultT1_degC: 190,
    notes: 'Saturated steam using IAPWS real-gas compressibility Z_steam near the saturation dome.',
  },
  {
    id: 'TWO_PHASE_FLASH_MIX',
    name: 'Two-Phase Flashing Condensate / Hydrocarbon (160 °C)',
    phase: 'TWO_PHASE',
    rho_kg_m3: 907.0,
    Pv_bar_a: 6.18,
    Pc_bar_a: 220.6,
    viscosity_cSt: 0.18,
    speedOfSound_m_s: 1300,
    molecularWeight: 18.015,
    gammaCpCv: 1.31,
    compressibilityZ: 0.95,
    massFractionGas_fg: 0.12,
    defaultT1_degC: 160,
    notes: 'Parcol §4.3 & Masoneilan two-phase separated/homogeneous mixture sizing with vapor quality fg.',
  },
  {
    id: 'COMPRESSED_AIR',
    name: 'Compressed Plant Air (35 °C)',
    phase: 'GAS',
    rho_kg_m3: 12.0,
    Pv_bar_a: 0,
    Pc_bar_a: 37.7,
    viscosity_cSt: 0.018,
    speedOfSound_m_s: 352,
    molecularWeight: 28.966,
    gammaCpCv: 1.40,
    compressibilityZ: 0.99,
    defaultT1_degC: 35,
    notes: 'Standard air benchmark from Warren Controls Table 2 (M=28.97, k=1.40).',
  },
  {
    id: 'AMMONIA_LIQUID',
    name: 'Liquid Anhydrous Ammonia (25 °C)',
    phase: 'LIQUID',
    rho_kg_m3: 602.0,
    Pv_bar_a: 10.03,
    Pc_bar_a: 112.9,
    viscosity_cSt: 0.22,
    speedOfSound_m_s: 1380,
    molecularWeight: 17.031,
    gammaCpCv: 1.31,
    compressibilityZ: 0.97,
    defaultT1_degC: 25,
    notes: 'High vapor pressure refrigeration / process fluid (avoid copper/bronze alloys).',
  },
  {
    id: 'CO2_GAS',
    name: 'Carbon Dioxide Gas (40 °C)',
    phase: 'GAS',
    rho_kg_m3: 42.0,
    Pv_bar_a: 0,
    Pc_bar_a: 73.8,
    viscosity_cSt: 0.015,
    speedOfSound_m_s: 275,
    molecularWeight: 44.01,
    gammaCpCv: 1.295,
    compressibilityZ: 0.88,
    defaultT1_degC: 40,
    notes: 'Dense high-MW gas from Warren Table 2 prone to Joule-Thomson cooling and low Z near Pc.',
  },
  {
    id: 'PROPANE_LIQUID',
    name: 'Liquid Propane LPG (25 °C)',
    phase: 'LIQUID',
    rho_kg_m3: 493.0,
    Pv_bar_a: 9.52,
    Pc_bar_a: 42.6,
    viscosity_cSt: 0.21,
    speedOfSound_m_s: 920,
    molecularWeight: 44.097,
    gammaCpCv: 1.13,
    compressibilityZ: 0.95,
    defaultT1_degC: 25,
    notes: 'Volatile light hydrocarbon (low FF factor near Pc, high flashing propensity).',
  },
  {
    id: 'HYDROGEN_GAS',
    name: 'High-Pressure Hydrogen Gas (30 °C)',
    phase: 'GAS',
    rho_kg_m3: 1.8,
    Pv_bar_a: 0,
    Pc_bar_a: 13.0,
    viscosity_cSt: 0.009,
    speedOfSound_m_s: 1320,
    molecularWeight: 2.016,
    gammaCpCv: 1.412,
    compressibilityZ: 1.01,
    defaultT1_degC: 30,
    notes: 'Ultra-low molecular weight gas requiring Class V/live-loaded fugitive emission stem packing.',
  },
  {
    id: 'CRUDE_OIL_LIGHT',
    name: 'Light Viscous Crude / Lube Oil (60 °C)',
    phase: 'LIQUID',
    rho_kg_m3: 825.0,
    Pv_bar_a: 0.45,
    Pc_bar_a: 32.0,
    viscosity_cSt: 8.5,
    speedOfSound_m_s: 1260,
    molecularWeight: 165.0,
    gammaCpCv: 1.08,
    compressibilityZ: 1.0,
    defaultT1_degC: 60,
    notes: 'Viscous oil benchmark demonstrating transitional Re_v and IEC 60534-2-1 FR correction.',
  },
  {
    id: 'METHANOL_LIQUID',
    name: 'Process Methanol Liquid (30 °C)',
    phase: 'LIQUID',
    rho_kg_m3: 782.0,
    Pv_bar_a: 0.22,
    Pc_bar_a: 79.5,
    viscosity_cSt: 0.66,
    speedOfSound_m_s: 1100,
    molecularWeight: 32.042,
    gammaCpCv: 1.20,
    compressibilityZ: 1.0,
    defaultT1_degC: 30,
    notes: 'Chemical solvent from Warren Table 2.',
  },
  {
    id: 'SEA_WATER_BRINE',
    name: 'Sea Water / High-Salinity Brine (25 °C)',
    phase: 'LIQUID',
    rho_kg_m3: 1025.0,
    Pv_bar_a: 0.031,
    Pc_bar_a: 220.6,
    viscosity_cSt: 1.05,
    speedOfSound_m_s: 1520,
    molecularWeight: 18.5,
    gammaCpCv: 1.33,
    compressibilityZ: 1.0,
    defaultT1_degC: 25,
    notes: 'Corrosive seawater injection/cooling duty favoring Duplex/Inconel/Super-Austenitic trims.',
  },
];

// Parcol Bulletin 1-I Fig. 7 Cavitation Resistance Index (relative to 316SS = 1.0)
// & Masoneilan Physics-Based Models Table 1 Thiruvengadam 1/3 Material Endurance Limit (MPa)
const MATERIAL_CAVITATION_AND_ENDURANCE: Record<
  string,
  { cavIndex: number; thirdEndurance_MPa: number }
> = {
  STELLITE_6: { cavIndex: 20.0, thirdEndurance_MPa: 185 },
  INCONEL_718: { cavIndex: 8.0, thirdEndurance_MPa: 165 },
  PH17_4_H900: { cavIndex: 2.0, thirdEndurance_MPa: 155 },
  PH17_4_H1150M: { cavIndex: 1.6, thirdEndurance_MPa: 130 },
  SS410_HT: { cavIndex: 1.5, thirdEndurance_MPa: 120 },
  CA6NM_13CR4NI: { cavIndex: 1.4, thirdEndurance_MPa: 108 },
  SS316TI_CR_HF: { cavIndex: 5.0, thirdEndurance_MPa: 135 },
  HASTELLOY_C276: { cavIndex: 2.2, thirdEndurance_MPa: 125 },
  SS316L: { cavIndex: 1.0, thirdEndurance_MPa: 82 },
};

function estimateTravelPctFromCv(
  requiredCv: number,
  ratedCv: number,
  characteristicType: string,
  equalPctRangeability: number
): number {
  const normPhi = Math.min(1.0, Math.max(0.005, requiredCv / Math.max(0.01, ratedCv)));
  if (characteristicType === 'EQUAL_PCT' || characteristicType === 'MODIFIED_EQUAL_PCT') {
    const R = Math.max(20, equalPctRangeability || 50);
    return Math.max(0, Math.min(100, (1 + Math.log(normPhi) / Math.log(R)) * 100));
  }
  if (characteristicType === 'QUICK_OPENING') {
    return Math.pow(normPhi, 2) * 100;
  }
  if (characteristicType === 'MODIFIED_PARABOLIC') {
    return Math.pow(normPhi, 1 / 1.75) * 100;
  }
  return normPhi * 100;
}

function getOshaNioshExposureSummary(dBA: number): string {
  if (dBA < 85) return '> 8 hr OK (OSHA/NIOSH)';
  if (dBA < 88) return 'NIOSH 4–8 hr | OSHA > 8 hr';
  if (dBA < 90) return 'NIOSH 2–4 hr | OSHA 8 hr Limit';
  if (dBA < 95) return 'NIOSH 0.5–2 hr | OSHA 4–6 hr';
  if (dBA < 100) return 'NIOSH 15 min | OSHA 2–3 hr';
  if (dBA < 110) return 'NIOSH < 15 min | OSHA 30 min';
  return 'HAZARDOUS (< 15 min / Fatigue)';
}

function computeSteamSaturationProperties(P1_bar_a: number, T1_degC: number): {
  Tsat_degC: number;
  superheat_degC: number;
  FSH: number;
  Z_steam: number;
  rho_steam: number;
} {
  // Antoine saturation curve for water/steam (P in Pa = P_bar * 1e5, valid ~0.1 to 215 bar a)
  const P_Pa = Math.max(5000, Math.min(2.15e7, P1_bar_a * 1e5));
  const Tsat_degC = 3816.44 / (23.1964 - Math.log(P_Pa)) - 227.02;
  const superheat_degC = Math.max(0, T1_degC - Tsat_degC);
  const FSH = 1 + 0.00126 * superheat_degC; // Equivalent Napier superheat factor for display

  const T1_K = Math.max(250, T1_degC + 273.15);
  const Pr = P1_bar_a / 220.6;
  const Tr = T1_K / 647.1;
  // Real-gas steam compressibility correlation anchored to IAPWS-IF97 near saturation & superheated region
  const Z_steam = Math.max(0.55, Math.min(1.0, 1.0 - 0.48 * (Pr / Math.pow(Math.max(0.4, Tr), 3.2))));
  const rho_steam = (P1_bar_a * 1e5 * 18.015) / Math.max(1, 8314.46 * T1_K * Z_steam);

  return {
    Tsat_degC: Number(Tsat_degC.toFixed(1)),
    superheat_degC: Number(superheat_degC.toFixed(1)),
    FSH: Number(FSH.toFixed(3)),
    Z_steam: Number(Z_steam.toFixed(3)),
    rho_steam,
  };
}

/**
 * Evaluates IEC 60534 / ISA-75.01 Multi-Condition Sizing, Swaged Piping Corrections (FP, FLP, xTP),
 * Stroke-Dependent FL(h)/Kc(h)/xT(h), Steam & Two-Phase Flow, Masoneilan Multistage YM,
 * Viscosity Correction (FR), ISA-RP75.23 Sigma, Thiruvengadam Water-Hammer, and Expander Noise.
 */
export function evaluateOperatingCase(params: {
  point: OperatingPointInput;
  piping: PipingConfiguration;
  valveD_mm: number;
  seatPort_mm: number;
  stroke_mm?: number;
  ratedCv: number;
  FL: number;
  Kc: number;
  xT: number;
  Fd: number;
  stages: number;
  drilledHoleDia_mm: number; // d_h from cage synthesis (e.g., 3.5 mm)
  characteristicType: string;
  equalPctRangeability: number;
  flowDirection?: FlowDirectionId;
  cageMaterialId?: string;
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
  const flowDir: FlowDirectionId = params.flowDirection || 'FTO';
  const strokeMm = params.stroke_mm || Math.max(19, seatPort_mm * 0.5);

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
  // N1 = 0.865 (Cv, m3/h, bar), N2 = 0.00214 (Cv, mm), N5 = 0.00241 (Cv, mm), N6 = 27.3 (Cv, kg/h, bar), N9 = 2120 (Cv, Nm3/h, bar)
  const N2_mm = 0.00214;
  const N5_mm = 0.00241;

  const steamProps =
    point.fluidPhase === 'STEAM'
      ? computeSteamSaturationProperties(P1, point.T1_degC)
      : { Tsat_degC: 0, superheat_degC: 0, FSH: 1.0, Z_steam: point.compressibilityZ, rho_steam: 1 };

  const multistageFactorFM =
    point.fluidPhase !== 'LIQUID' && stages >= 2 ? (stages === 2 ? 0.74 : 0.62) : 1.0;

  let estCv = Math.min(ratedCv, Math.max(0.5, ratedCv * 0.6));
  let FP = 1.0;
  let FLP = FL;
  let xTP = xT;
  let FL_atTravel = FL;
  let Kc_atTravel = Kc;
  let xT_atTravel = xT;
  let twoPhaseModelUsed = 'N/A';

  for (let iter = 0; iter < 5; iter++) {
    const estTravel = estimateTravelPctFromCv(
      estCv,
      ratedCv,
      params.characteristicType,
      params.equalPctRangeability
    );
    const strokeRecovery = evaluateStrokeDependentRecovery({
      FL_rated: FL,
      Kc_rated: Kc,
      xT_rated: xT,
      travelPct: estTravel,
      stages,
      flowDirection: flowDir,
    });
    FL_atTravel = strokeRecovery.FL_atTravel;
    Kc_atTravel = strokeRecovery.Kc_atTravel;
    xT_atTravel = strokeRecovery.xT_atTravel;

    const cv_d2 = estCv / (d_mm * d_mm);
    const cv_d2_sq = cv_d2 * cv_d2;

    FP =
      sigmaK > 1e-5
        ? 1.0 / Math.sqrt(1.0 + (sigmaK / N2_mm) * cv_d2_sq)
        : 1.0;
    FLP =
      K1_plus_KB1 > 1e-5
        ? 1.0 / Math.sqrt((K1_plus_KB1 / N2_mm) * cv_d2_sq + 1.0 / (FL_atTravel * FL_atTravel))
        : FL_atTravel;
    xTP =
      K1_plus_KB1 > 1e-5
        ? (xT_atTravel / (FP * FP)) *
          (1.0 / (1.0 + ((xT_atTravel * K1_plus_KB1) / N5_mm) * cv_d2_sq))
        : xT_atTravel;

    if (point.fluidPhase === 'LIQUID') {
      const Gf = Math.max(0.1, point.rho_kg_m3 / 999.0);
      const FF =
        0.96 -
        0.28 *
          Math.sqrt(
            Math.max(0, Math.min(0.99, point.Pv_bar_a / Math.max(1, point.Pc_bar_a)))
          );
      const dP_choked = Math.max(
        0.01,
        Math.pow(FLP / Math.max(0.1, FP), 2) * Math.max(0.01, P1 - FF * point.Pv_bar_a)
      );
      const dP_eff = Math.min(deltaP, dP_choked);
      // IEC 60534-2-1: Cv = Q_m3h / (0.865 * FP * sqrt(dP_eff / Gf))
      estCv = point.flowRate / (0.865 * FP * Math.sqrt(dP_eff / Gf));
    } else if (point.fluidPhase === 'GAS') {
      const Fgamma = Math.max(0.5, point.gammaCpCv / 1.40);
      const x = deltaP / P1;
      const x_choked = Fgamma * xTP;
      const x_eff = Math.min(x, x_choked);
      const x_for_Y = Math.min(multistageFactorFM * x, x_choked);
      const Y = Math.max(0.667, 1.0 - x_for_Y / (3.0 * x_choked));
      // IEC 60534-2-1 N9 = 2120 (Cv, Nm3/h at 0°C, bar)
      const denom =
        2120 *
        FP *
        P1 *
        Y *
        Math.sqrt(x_eff / Math.max(1, point.molecularWeight * T1_K * point.compressibilityZ));
      estCv = point.flowRate / Math.max(1e-4, denom);
    } else if (point.fluidPhase === 'STEAM') {
      const Fgamma = Math.max(0.5, point.gammaCpCv / 1.40);
      const x = deltaP / P1;
      const x_choked = Fgamma * xTP;
      const x_eff = Math.min(x, x_choked);
      const x_for_Y = Math.min(multistageFactorFM * x, x_choked);
      const Y = Math.max(0.667, 1.0 - x_for_Y / (3.0 * x_choked));
      // IEC 60534-2-1 N6 = 27.3 (Cv, kg/h, bar, kg/m3) with IAPWS-anchored real steam density
      estCv =
        point.flowRate /
        (27.3 * FP * Y * Math.sqrt(Math.max(1e-4, x_eff * P1 * steamProps.rho_steam)));
    } else {
      // TWO_PHASE: Parcol Bulletin 1-I §4.3 & Warren Controls Two-Phase Sizing
      const fg = Math.min(0.99, Math.max(0.005, point.massFractionGas_fg ?? 0.12));
      const fliq = 1 - fg;
      const Fgamma = Math.max(0.5, point.gammaCpCv / 1.40);
      const x = deltaP / P1;
      const x_choked = Fgamma * xTP;
      const x_eff = Math.min(x, x_choked);
      const x_for_Y = Math.min(multistageFactorFM * x, x_choked);
      const Y = Math.max(0.667, 1.0 - x_for_Y / (3.0 * x_choked));

      const rho_liq = Math.max(100, point.rho_kg_m3);
      const rho_g1 =
        (P1 * 1e5 * point.molecularWeight) /
        Math.max(1, 8314.46 * T1_K * point.compressibilityZ);
      const V_liq1 = 1.0 / rho_liq;
      const V_g1 = 1.0 / Math.max(0.05, rho_g1);

      const FF_tp =
        0.96 -
        0.28 *
          Math.sqrt(
            Math.max(0, Math.min(0.99, point.Pv_bar_a / Math.max(1, point.Pc_bar_a)))
          );
      const dP_choked_liq = Math.max(
        0.01,
        Math.pow(FLP / Math.max(0.1, FP), 2) * Math.max(0.01, P1 - FF_tp * point.Pv_bar_a)
      );
      const dP_eff_liq = Math.min(deltaP, dP_choked_liq);

      if (fg < 0.05) {
        twoPhaseModelUsed = 'Parcol §4.3 Separated (Cv_liq + Cv_gas)';
        const rho_r = rho_liq / 999.0;
        const cvLiq =
          (point.flowRate * fliq) /
          (865 * FP * Math.sqrt(Math.max(1e-4, dP_eff_liq * rho_r)));
        const cvGas =
          (point.flowRate * fg) /
          (27.3 * FP * Y * Math.sqrt(Math.max(1e-4, x_eff * P1 * rho_g1)));
        estCv = cvLiq + cvGas;
      } else {
        twoPhaseModelUsed = 'Parcol §4.3 Homogeneous (Ve Effective Vol.)';
        const Ve = (fg * V_g1) / (Y * Y) + fliq * V_liq1;
        estCv = point.flowRate / (27.3 * FP * Math.sqrt(Math.max(1e-6, (x_eff * P1) / Ve)));
      }
    }
  }

  // 2. Final Sizing, Viscosity Correction (Re_v & F_R), and ISA-RP75.23 Sigma
  let deltaP_choked = deltaP;
  let deltaP_effective = deltaP;
  let isChoked = false;
  let Rev = 1e6;
  let FR = 1.0;
  let requiredCv = estCv;
  let FF = 0.96;
  let FL_required = 0;
  let sigmaCavitation = 9.99;
  let sigmaIncipient_i = 0;
  let sigmaConstant_c = 0;
  let sigmaRecommended_mr = 0;
  let sigmaMaxVibration_mv = 0;
  let xFZ = 0.5;
  let Kc_effective = Kc_atTravel;
  let regime: CavitationRegime = 'NON_CAVITATING';
  let regimeLabel = 'Clean Single-Phase Flow';
  let regimeSeverity: 'PASS' | 'WARNING' | 'CRITICAL' = 'PASS';

  const matInfo =
    MATERIAL_CAVITATION_AND_ENDURANCE[params.cageMaterialId || 'SS410_HT'] ||
    MATERIAL_CAVITATION_AND_ENDURANCE.SS410_HT;
  const materialCavitationIndex = matInfo.cavIndex;
  const thiruvengadamEnduranceLimit_MPa = matInfo.thirdEndurance_MPa;

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

    // Warren Controls VSSTR-07/12 Required FL
    FL_required = Math.sqrt(deltaP / Math.max(0.01, P1 - FF * point.Pv_bar_a));

    // Turbulent Cv per IEC 60534-2-1
    const cvTurbulent =
      point.flowRate / (0.865 * FP * Math.sqrt(deltaP_effective / Gf));

    // Valve Reynolds Number Re_v per IEC 60534-2-1 (N4 = 76000 for Cv, Q in m3/h, nu in cSt)
    const nu = Math.max(0.05, point.viscosity_cSt);
    const termFourth =
      1 +
      Math.pow(
        (FL_atTravel * FL_atTravel * cvTurbulent * cvTurbulent) /
          (N2_mm * Math.pow(d_mm, 4)),
        2
      );
    Rev =
      ((76000 * Fd * point.flowRate) /
        (nu * Math.sqrt(FL_atTravel * Math.max(0.01, cvTurbulent)))) *
      Math.pow(termFourth, 0.25);

    if (Rev < 10000) {
      const logRe = Math.log10(Math.max(1, Rev));
      FR = Math.min(1.0, Math.max(0.18, 0.026 * Math.pow(logRe, 3.85)));
    } else {
      FR = 1.0;
    }

    requiredCv = cvTurbulent / FR;

    // Cavitation, Flashing & ISA-RP75.23 Multi-Regime Sigma Classification
    sigmaCavitation = (P1 - point.Pv_bar_a) / Math.max(0.01, deltaP);
    const stageMultiplier = stages === 1 ? 1.0 : stages === 2 ? 1.65 : 2.35;

    xFZ = Math.min(
      Kc_atTravel * 0.92,
      Math.max(
        0.18,
        0.9 / Math.sqrt(1 + 2.5 * Fd * Math.sqrt(Math.max(1, requiredCv) / FL_atTravel))
      )
    );
    xFZ = Math.min(0.96, xFZ * Math.pow(stageMultiplier, 0.35));
    Kc_effective = Math.min(0.98, 1 - (1 - Kc_atTravel) / stageMultiplier);

    sigmaIncipient_i = 1 / Math.max(0.12, xFZ);
    sigmaConstant_c = 1 / Math.max(0.15, Kc_effective);
    sigmaMaxVibration_mv = 1.05 / Math.max(0.15, FLP * FLP);
    const matBonus = Math.min(0.18, Math.log10(Math.max(1, materialCavitationIndex)) * 0.12);
    sigmaRecommended_mr =
      stages >= 2
        ? Math.max(1.04, (sigmaMaxVibration_mv * (1 - matBonus)) / Math.pow(stages, 0.35))
        : Math.max(
            1.08,
            (0.55 * sigmaConstant_c + 0.45 * sigmaMaxVibration_mv) * (1 - 0.5 * matBonus)
          );

    const dP_ratio = deltaP / Math.max(0.01, P1 - point.Pv_bar_a);

    if (P2 <= point.Pv_bar_a) {
      regime = 'FLASHING';
      regimeLabel = 'Flashing Two-Phase Flow (P2 ≤ Pv)';
      regimeSeverity = 'CRITICAL';
    } else if (
      deltaP >= deltaP_choked * stageMultiplier ||
      sigmaCavitation < sigmaRecommended_mr * 0.85
    ) {
      regime = 'SEVERE_CAVITATION';
      regimeLabel = 'Severe / Destructive Choked Cavitation (σ < σ_mr)';
      regimeSeverity = 'CRITICAL';
    } else if (dP_ratio >= Kc_effective || sigmaCavitation < sigmaRecommended_mr) {
      regime = 'CHOKING_CAVITATION';
      regimeLabel = 'Constant / Choking Cavitation (ΔP ≥ Kc·(P1-Pv))';
      regimeSeverity = stages >= 2 ? 'WARNING' : 'CRITICAL';
    } else if (dP_ratio >= xFZ || sigmaCavitation < sigmaIncipient_i) {
      regime = 'INCIPIENT_CAVITATION';
      regimeLabel = 'Incipient Cavitation (σ < σ_i)';
      regimeSeverity = 'WARNING';
    } else {
      regime = 'NON_CAVITATING';
      regimeLabel = 'Non-Cavitating Liquid Service (σ > σ_i)';
      regimeSeverity = 'PASS';
    }
  } else if (point.fluidPhase === 'TWO_PHASE') {
    const Fgamma = Math.max(0.5, point.gammaCpCv / 1.40);
    const x = deltaP / P1;
    const x_choked = Fgamma * xTP;
    isChoked = x >= x_choked;
    const x_eff = Math.min(x, x_choked);
    deltaP_choked = x_choked * P1;
    deltaP_effective = x_eff * P1;
    requiredCv = estCv;
    const fg = point.massFractionGas_fg ?? 0.12;
    regime = fg < 0.05 ? 'TWO_PHASE_SEPARATED' : 'TWO_PHASE_HOMOGENEOUS';
    regimeLabel = isChoked
      ? `Two-Phase Choked (${twoPhaseModelUsed})`
      : `Two-Phase Subsonic (${twoPhaseModelUsed})`;
    regimeSeverity = isChoked || P2 <= point.Pv_bar_a ? 'WARNING' : 'PASS';
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
      ? `Choked / Sonic Vena Contracta${stages >= 2 ? ` (FM=${multistageFactorFM})` : ''}`
      : `Subsonic Compressible Expansion${stages >= 2 ? ` (FM=${multistageFactorFM})` : ''}`;
    regimeSeverity = isChoked ? 'WARNING' : 'PASS';
  }

  const requiredKv = 0.865 * requiredCv;
  const percentOfRatedCv = (requiredCv / Math.max(0.01, ratedCv)) * 100;
  const estimatedTravelPct = estimateTravelPctFromCv(
    requiredCv,
    ratedCv,
    params.characteristicType,
    params.equalPctRangeability
  );

  // 3. Velocity, Mach, Warren Table 6 Body Velocity Limit & Thiruvengadam Water-Hammer Checks
  const bodyArea_m2 = (Math.PI / 4) * Math.pow(d_mm / 1000, 2);
  const pipeDownArea_m2 = (Math.PI / 4) * Math.pow(D2_mm / 1000, 2);
  const trimCurtainArea_m2 = Math.max(1e-6, (requiredCv / 38.0) * 0.00064516);

  // Warren Controls Table 6 Liquid Body Velocity Limits (34.5 bar = 500 psi cutoff)
  const highDp500Psi = deltaP >= 34.5;
  let bodyVelocityLimit_m_s =
    piping.bodyMaterialCategory === 'STAINLESS_ALLOY'
      ? highDp500Psi
        ? 13.7
        : 18.3
      : highDp500Psi
      ? 9.1
      : 12.2;

  let bodyVelocity_m_s = 0;
  let trimExitVelocity_m_s = 0;
  let venaContractaVelocity_m_s = 0;
  let trimKineticEnergy_kPa = 0;
  let outletMach = 0;
  // Warren Controls / IEC 60534-8-3 outlet Mach limits (1/3 sonic = 0.33 for DB II low noise, 0.50 for std DB I)
  const outletMachLimit = stages >= 2 ? 0.25 : stages >= 1 ? 0.33 : 0.45;
  let pipeMach = 0;
  let joukowskySurge_bar = 0;
  let minSafeCloseTime_s = 1.0;
  let waterHammerSurfacePressure_MPa = 0;
  let fluidSoundSpeed_m_s = Math.max(300, point.speedOfSound_m_s);

  if (point.fluidPhase === 'LIQUID') {
    const Q_m3_s = point.flowRate / 3600;
    bodyVelocity_m_s = Q_m3_s / bodyArea_m2;
    // Trim exit velocity based on effective pressure drop across active stages
    trimExitVelocity_m_s = Math.sqrt(
      (2 * (deltaP_effective / Math.max(1, stages)) * 1e5) / Math.max(100, point.rho_kg_m3)
    );
    // Vena contracta jet velocity: U_vc = sqrt(2 * dP_effective / (rho * FL^2))
    const FL_val = Math.max(0.3, FL_atTravel);
    venaContractaVelocity_m_s = Math.sqrt(
      (2 * deltaP_effective * 1e5) / (Math.max(100, point.rho_kg_m3) * Math.pow(FL_val, 2))
    );
    // Dynamic fluid kinetic energy head KE = 0.5 * rho * v^2 in kPa
    trimKineticEnergy_kPa = (0.5 * point.rho_kg_m3 * Math.pow(trimExitVelocity_m_s, 2)) / 1000;

    const cL = Math.max(500, point.speedOfSound_m_s);
    fluidSoundSpeed_m_s = cL;
    outletMach = bodyVelocity_m_s / cL;
    pipeMach = Q_m3_s / pipeDownArea_m2 / cL;

    // Joukowsky Water-Hammer Pipe Surge (Skousen Ch. 9)
    const pipeVel_m_s = Q_m3_s / pipeDownArea_m2;
    const acousticReflectionTime_s = (2 * Math.max(10, piping.upstreamPipeLength_m)) / cL;
    minSafeCloseTime_s = Number((acousticReflectionTime_s * 5.0).toFixed(2));
    const effectiveShutoffFactor =
      piping.actuatorCloseTime_s <= acousticReflectionTime_s
        ? 1.0
        : acousticReflectionTime_s / piping.actuatorCloseTime_s;
    joukowskySurge_bar =
      (point.rho_kg_m3 * cL * pipeVel_m_s * effectiveShutoffFactor) / 1e5;

    // Masoneilan Thiruvengadam Trim Surface Water-Hammer Stress Pwh = rho * c * UN * (1 + 2*UN/c)
    waterHammerSurfacePressure_MPa =
      (point.rho_kg_m3 * cL * trimExitVelocity_m_s * (1 + (2 * trimExitVelocity_m_s) / cL)) /
      1e6;
  } else {
    // Compressible or Two-Phase mass flow rate m_dot (kg/s)
    const Z_eff = point.fluidPhase === 'STEAM' ? steamProps.Z_steam : point.compressibilityZ;
    const rhoStd = point.molecularWeight / 22.414;
    const m_dot_kg_s =
      point.fluidPhase === 'GAS'
        ? (point.flowRate * rhoStd) / 3600
        : point.flowRate / 3600;

    const R_specific = 8314.46 / Math.max(2, point.molecularWeight);
    const sonicSpeed_m_s = Math.sqrt(point.gammaCpCv * R_specific * T1_K * Z_eff);
    fluidSoundSpeed_m_s = sonicSpeed_m_s;
    const rhoGasDown = (P2 * 1e5) / Math.max(1, R_specific * T1_K * Z_eff);

    let rhoDownstream = rhoGasDown;
    if (point.fluidPhase === 'TWO_PHASE') {
      const fg = Math.min(0.99, Math.max(0.005, point.massFractionGas_fg ?? 0.12));
      const mixSpVolDown = fg / Math.max(0.05, rhoGasDown) + (1 - fg) / Math.max(100, point.rho_kg_m3);
      rhoDownstream = 1 / Math.max(1e-4, mixSpVolDown);
    }

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

    // IEC 60534-8-3 Vena Contracta Jet Mach and Velocity
    const x_ratio = deltaP / P1;
    const gamma = Math.max(1.05, point.gammaCpCv);
    const x_choked_limit = (gamma / 1.4) * Math.max(0.1, xT_atTravel);
    if (x_ratio >= x_choked_limit) {
      // Sonic/choked throat
      venaContractaVelocity_m_s = Math.sqrt(((2 * gamma) / (gamma + 1)) * R_specific * T1_K * Z_eff);
    } else {
      const p_vc_ratio = Math.max(0.05, 1 - x_ratio / Math.max(0.1, Math.pow(FL_atTravel, 2)));
      const mach_vc = Math.min(
        1.0,
        Math.sqrt((2 / (gamma - 1)) * (Math.pow(1 / p_vc_ratio, (gamma - 1) / gamma) - 1))
      );
      const T_vc_K = T1_K / (1 + ((gamma - 1) / 2) * Math.pow(mach_vc, 2));
      venaContractaVelocity_m_s = mach_vc * Math.sqrt(gamma * R_specific * T_vc_K * Z_eff);
    }

    // Dynamic fluid kinetic energy head KE = 0.5 * rho * v^2 in kPa
    trimKineticEnergy_kPa = (0.5 * rhoDownstream * Math.pow(trimExitVelocity_m_s, 2)) / 1000;

    // Thiruvengadam water-hammer stress check (droplet impact in Two-Phase / wet steam vs gas)
    const impactRho = point.fluidPhase === 'TWO_PHASE' ? point.rho_kg_m3 : rhoDownstream;
    const impactC =
      point.fluidPhase === 'TWO_PHASE' ? point.speedOfSound_m_s : sonicSpeed_m_s;
    const dropletFactor = point.fluidPhase === 'TWO_PHASE' ? 0.5 : 1.0; // Engel 0.5 droplet factor per Masoneilan p. 3
    waterHammerSurfacePressure_MPa =
      (dropletFactor * impactRho * impactC * trimExitVelocity_m_s) / 1e6;
  }

  const trimKineticEnergy_psi = trimKineticEnergy_kPa * 0.1450377;

  const thiruvengadamErosionRatioPct = Number(
    ((waterHammerSurfacePressure_MPa / Math.max(10, thiruvengadamEnduranceLimit_MPa)) * 100).toFixed(1)
  );

  // 4. IEC 60534-8-3/8-4 Noise + Masoneilan Pipe Coincidence Frequency f_o + Expander Noise SPL_E + Low-Freq Pulsation
  const ringFreq_Hz = Math.round(5050 / (Math.PI * (D2_mm / 1000)));
  const coincidenceFreq_Hz = Math.round((ringFreq_Hz / 4) * (fluidSoundSpeed_m_s / 343));

  const dH_std_m = Math.max(0.008, (seatPort_mm * 0.45) / 1000);
  const dH_drilled_m = Math.max(0.0015, drilledHoleDia_mm / 1000);

  const U_vc = Math.max(5, trimExitVelocity_m_s);
  const strouhalPeakFreq_Hz = Math.round((0.2 * U_vc) / dH_drilled_m);
  const strouhalStdFreq_Hz = Math.round((0.2 * U_vc) / dH_std_m);

  let noiseStandardTrim_dBA = 55;
  let noiseDrilledCage_dBA = 48;
  let expanderNoise_dBA = 0;

  if (point.fluidPhase === 'LIQUID') {
    const Q_m3_s = point.flowRate / 3600;
    const Wm_watts = Math.max(1, Q_m3_s * (deltaP * 1e5));
    let eta = 1.2e-8 * Math.pow(deltaP / Math.max(0.1, FL_atTravel), 1.5);
    if (regime === 'INCIPIENT_CAVITATION') eta *= 18;
    if (regime === 'CHOKING_CAVITATION') eta *= 160;
    if (regime === 'SEVERE_CAVITATION' || regime === 'FLASHING') eta *= 650;

    const Wa_std = Wm_watts * eta;
    const t_p_m = Math.max(0.003, piping.pipeWallThickness_mm / 1000);
    const TL_std = 36 + 10 * Math.log10((t_p_m * 1000) / Math.max(15, D2_mm));
    noiseStandardTrim_dBA = Math.min(
      118,
      Math.max(42, 10 * Math.log10(Math.max(1e-12, Wa_std) / 1e-12) - TL_std - 8)
    );

    const freqShiftGain_dB =
      4.5 * Math.log10(Math.max(1, strouhalPeakFreq_Hz / Math.max(100, strouhalStdFreq_Hz)));
    const stageGain_dB = (stages - 1) * 7.5 + (stages >= 1 ? 6.5 : 0);
    noiseDrilledCage_dBA = Math.max(
      40,
      noiseStandardTrim_dBA - freqShiftGain_dB - stageGain_dB
    );
  } else {
    const rhoStd = point.molecularWeight / 22.414;
    const m_dot_kg_s =
      point.fluidPhase === 'GAS'
        ? (point.flowRate * rhoStd) / 3600
        : point.flowRate / 3600;
    const Wm_watts = Math.max(1, 0.5 * m_dot_kg_s * U_vc * U_vc);
    const x_ratio = deltaP / P1;
    const machJet = Math.min(
      2.2,
      Math.sqrt(
        (2 / Math.max(0.08, point.gammaCpCv - 1)) *
          (Math.pow(P1 / P2, (point.gammaCpCv - 1) / point.gammaCpCv) - 1)
      )
    );
    const eta_aero = Math.min(0.01, 1.4e-4 * Math.pow(Math.max(0.2, machJet), 3.6) * x_ratio);
    const Wa_std = Wm_watts * eta_aero;

    const t_p_m = Math.max(0.003, piping.pipeWallThickness_mm / 1000);
    const TL_base = 42 + 12 * Math.log10((t_p_m * 1000) / Math.max(15, D2_mm));
    const stdTrimOnly = Math.min(
      125,
      Math.max(45, 10 * Math.log10(Math.max(1e-12, Wa_std) / 1e-12) - TL_base)
    );

    const holeFreqGain_dB =
      11.5 * Math.log10(Math.max(1, dH_std_m / dH_drilled_m));
    const stageLetdownGain_dB = (stages - 1) * 8.5;
    const machOutletPenalty_dB =
      outletMach > 0.22 ? 18 * Math.log10(outletMach / 0.22) : 0;

    const drilledTrimOnly = Math.max(
      42,
      stdTrimOnly - holeFreqGain_dB - stageLetdownGain_dB + machOutletPenalty_dB
    );

    // Masoneilan Expander Noise SPL_E (proportional to Mv^6 when D2 > d and Mv > 0.15)
    if (D2_mm > d_mm * 1.02 && outletMach > 0.15) {
      const expRatioTerm = 10 * Math.log10(Math.max(1.05, D2_mm / d_mm));
      expanderNoise_dBA = Math.max(
        40,
        96 +
          60 * Math.log10(Math.max(0.15, outletMach)) +
          expRatioTerm -
          12 * Math.log10((t_p_m * 1000) / Math.max(15, D2_mm))
      );
      noiseStandardTrim_dBA =
        10 * Math.log10(Math.pow(10, stdTrimOnly / 10) + Math.pow(10, expanderNoise_dBA / 10));
      noiseDrilledCage_dBA =
        10 *
        Math.log10(Math.pow(10, drilledTrimOnly / 10) + Math.pow(10, expanderNoise_dBA / 10));
    } else {
      noiseStandardTrim_dBA = stdTrimOnly;
      noiseDrilledCage_dBA = drilledTrimOnly;
    }
  }

  const noiseAttenuation_dBA = Math.max(0, noiseStandardTrim_dBA - noiseDrilledCage_dBA);
  const noiseStatus: 'PASS' | 'WARNING' | 'CRITICAL' =
    noiseDrilledCage_dBA <= 82
      ? 'PASS'
      : noiseDrilledCage_dBA <= 85
      ? 'WARNING'
      : 'CRITICAL';

  // Masoneilan Schafbuch/Kiuchi Low-Frequency Upstream Pulsation Check (FTO >70% lift & H/d_port > 0.45)
  const strokeToPortAspectRatio = Number((strokeMm / Math.max(5, seatPort_mm)).toFixed(2));
  const lowFreqPulsationRisk =
    flowDir === 'FTO' && estimatedTravelPct > 70 && strokeToPortAspectRatio > 0.45;

  const oshaNioshExposureSummary = getOshaNioshExposureSummary(noiseDrilledCage_dBA);

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
    FL_effectiveAtTravel: FL_atTravel,
    xT_effectiveAtTravel: xT_atTravel,
    FL_required: Number(FL_required.toFixed(3)),
    Rev: Math.round(Rev),
    FR: Number(FR.toFixed(3)),
    requiredCv: Number(requiredCv.toFixed(2)),
    requiredKv: Number(requiredKv.toFixed(2)),
    percentOfRatedCv: Number(percentOfRatedCv.toFixed(1)),
    estimatedTravelPct: Number(estimatedTravelPct.toFixed(1)),
    steamSuperheat_degC: steamProps.superheat_degC,
    steamSuperheatFactorFSH: steamProps.FSH,
    multistageFactorFM,
    twoPhaseModelUsed,
    FF: Number(FF.toFixed(3)),
    sigmaCavitation: Number(sigmaCavitation.toFixed(2)),
    sigmaIncipient_i: Number(sigmaIncipient_i.toFixed(2)),
    sigmaConstant_c: Number(sigmaConstant_c.toFixed(2)),
    sigmaRecommended_mr: Number(sigmaRecommended_mr.toFixed(2)),
    sigmaMaxVibration_mv: Number(sigmaMaxVibration_mv.toFixed(2)),
    materialCavitationIndex,
    xFZ: Number(xFZ.toFixed(2)),
    Kc_effective: Number(Kc_effective.toFixed(2)),
    regime,
    regimeLabel,
    regimeSeverity,
    bodyVelocity_m_s: Number(bodyVelocity_m_s.toFixed(2)),
    bodyVelocityLimit_m_s: Number(bodyVelocityLimit_m_s.toFixed(1)),
    trimExitVelocity_m_s: Number(trimExitVelocity_m_s.toFixed(1)),
    venaContractaVelocity_m_s: Number(venaContractaVelocity_m_s.toFixed(1)),
    trimKineticEnergy_kPa: Number(trimKineticEnergy_kPa.toFixed(1)),
    trimKineticEnergy_psi: Number(trimKineticEnergy_psi.toFixed(1)),
    outletMach: Number(outletMach.toFixed(3)),
    outletMachLimit,
    pipeMach: Number(pipeMach.toFixed(3)),
    joukowskySurge_bar: Number(joukowskySurge_bar.toFixed(2)),
    minSafeCloseTime_s,
    waterHammerSurfacePressure_MPa: Number(waterHammerSurfacePressure_MPa.toFixed(1)),
    thiruvengadamEnduranceLimit_MPa,
    thiruvengadamErosionRatioPct,
    ...(() => {
      // API RP 14E Erosional Velocity: Ve = C / sqrt(rho_m) with C = 122 (metric continuous service)
      const rho_mix =
        point.fluidPhase === 'LIQUID'
          ? regime === 'FLASHING'
            ? Math.max(10, point.rho_kg_m3 * 0.25) // flashing two-phase mixture density drop
            : Math.max(100, point.rho_kg_m3)
          : Math.max(0.5, (P2 * 1e5 * point.molecularWeight) / (8314.46 * T1_K * point.compressibilityZ));
      const erosionalVelocity_m_s = 122 / Math.sqrt(rho_mix);
      const erosionalVelocityRatio = bodyVelocity_m_s / Math.max(0.1, erosionalVelocity_m_s);
      const expandedOutletRecommended =
        erosionalVelocityRatio > 1.0 || outletMach > outletMachLimit || regime === 'FLASHING';
      return {
        erosionalVelocity_m_s: Number(erosionalVelocity_m_s.toFixed(1)),
        erosionalVelocityRatio: Number(erosionalVelocityRatio.toFixed(2)),
        expandedOutletRecommended,
      };
    })(),
    strouhalPeakFreq_Hz,
    ringFreq_Hz,
    coincidenceFreq_Hz,
    expanderNoise_dBA: Number(expanderNoise_dBA.toFixed(1)),
    noiseStandardTrim_dBA: Number(noiseStandardTrim_dBA.toFixed(1)),
    noiseDrilledCage_dBA: Number(noiseDrilledCage_dBA.toFixed(1)),
    noiseAttenuation_dBA: Number(noiseAttenuation_dBA.toFixed(1)),
    noiseStatus,
    strokeToPortAspectRatio,
    lowFreqPulsationRisk,
    oshaNioshExposureSummary,
  };
}

export interface BackpressureOrificeCaseResult {
  id: string;
  label: string;
  originalValveDeltaP_bar: number;
  orificeDeltaP_bar: number;
  midPressurePmid_bar_a: number;
  sharedValveDeltaP_bar: number;
  originalSigma: number;
  sharedSigma: number;
  orificeSigma: number;
  orificeChokedWarning: boolean;
  sharedCavitationResolved: boolean;
  sharedNoiseReduction_dBA: number;
}

export interface BackpressureOrificeSummary {
  orificeRatedCv: number;
  equivalentOrificeBore_mm: number;
  orificeBetaRatio: number;
  designMaxCaseLabel: string;
  orificeDeltaPAtMax_bar: number;
  caseShares: BackpressureOrificeCaseResult[];
}

/**
 * Downstream Backpressure Orifice / Diffuser Pressure-Sharing Calculator
 * Per Warren Controls VSSTR-07/12 (pp. 9 & 16) and Parcol Bulletin 1-I.
 * Shares total system ΔP with a downstream restriction plate/diffuser sized at Max Flow,
 * raising valve outlet backpressure P_mid (= P2 + ΔP_orifice) to elevate cavitation σ and reduce noise.
 */
export function evaluateBackpressureOrificeSharing(params: {
  cases: OperatingPointInput[];
  downstreamPipeID_mm: number;
  orificeDeltaPShareAtMaxPct: number; // e.g. 20 to 70%
}): BackpressureOrificeSummary {
  const activeCases = params.cases.filter((c) => c.enabled);
  const shareFrac = Math.min(0.75, Math.max(0.1, params.orificeDeltaPShareAtMaxPct / 100));

  if (activeCases.length === 0) {
    return {
      orificeRatedCv: 0,
      equivalentOrificeBore_mm: 0,
      orificeBetaRatio: 0,
      designMaxCaseLabel: 'None',
      orificeDeltaPAtMax_bar: 0,
      caseShares: [],
    };
  }

  // Design the fixed orifice on the highest flow case
  const maxCase = activeCases.reduce((prev, curr) =>
    curr.flowRate > prev.flowRate ? curr : prev
  );
  const dPMaxTotal = Math.max(0.05, maxCase.P1_bar_a - maxCase.P2_bar_a);
  const dPOrfAtMax = dPMaxTotal * shareFrac;
  const PmidAtMax = maxCase.P2_bar_a + dPOrfAtMax;

  let orificeRatedCv = 50;
  if (maxCase.fluidPhase === 'LIQUID') {
    const Gf = Math.max(0.1, maxCase.rho_kg_m3 / 999.0);
    orificeRatedCv = maxCase.flowRate / (0.865 * Math.sqrt(Math.max(0.01, dPOrfAtMax) / Gf));
  } else if (maxCase.fluidPhase === 'GAS') {
    const T_K = Math.max(50, maxCase.T1_degC + 273.15);
    const x_orf = Math.min(0.42, dPOrfAtMax / Math.max(0.2, PmidAtMax));
    const Y_orf = Math.max(0.667, 1 - x_orf / 1.8);
    orificeRatedCv =
      maxCase.flowRate /
      (2120 *
        PmidAtMax *
        Y_orf *
        Math.sqrt(x_orf / Math.max(1, maxCase.molecularWeight * T_K * maxCase.compressibilityZ)));
  } else {
    const T_K = Math.max(50, maxCase.T1_degC + 273.15);
    const rhoMid =
      (PmidAtMax * 1e5 * maxCase.molecularWeight) /
      Math.max(1, 8314.46 * T_K * maxCase.compressibilityZ);
    const x_orf = Math.min(0.42, dPOrfAtMax / Math.max(0.2, PmidAtMax));
    const Y_orf = Math.max(0.667, 1 - x_orf / 1.8);
    orificeRatedCv =
      maxCase.flowRate / (27.3 * Y_orf * Math.sqrt(Math.max(1e-4, x_orf * PmidAtMax * rhoMid)));
  }

  // Single-plate sharp-edge orifice equivalent bore: Cv ≈ 0.036 * d_mm^2
  const rawBore_mm = Math.sqrt(Math.max(4, orificeRatedCv) / 0.036);
  const maxPipeBore_mm = Math.max(15, params.downstreamPipeID_mm) * 0.92;
  const equivalentOrificeBore_mm = Math.min(maxPipeBore_mm, rawBore_mm);
  const orificeBetaRatio = equivalentOrificeBore_mm / Math.max(15, params.downstreamPipeID_mm);

  const caseShares: BackpressureOrificeCaseResult[] = activeCases.map((c) => {
    const totalDp = Math.max(0.01, c.P1_bar_a - c.P2_bar_a);
    const flowRatio = Math.max(0, c.flowRate / Math.max(0.01, maxCase.flowRate));
    // Fixed restriction ΔP scales with Q^2 (capped safely below total available ΔP)
    const rawOrfDp = dPOrfAtMax * flowRatio * flowRatio;
    const orificeDeltaP_bar = Math.min(totalDp * 0.88, rawOrfDp);
    const midPressurePmid_bar_a = c.P2_bar_a + orificeDeltaP_bar;
    const sharedValveDeltaP_bar = Math.max(0.05, c.P1_bar_a - midPressurePmid_bar_a);

    const originalSigma = (c.P1_bar_a - c.Pv_bar_a) / Math.max(0.01, totalDp);
    const sharedSigma = (c.P1_bar_a - c.Pv_bar_a) / Math.max(0.01, sharedValveDeltaP_bar);
    const orificeSigma = Number(
      ((c.P2_bar_a - c.Pv_bar_a) / Math.max(0.01, orificeDeltaP_bar)).toFixed(2)
    );
    const orificeChokedWarning =
      c.fluidPhase === 'LIQUID'
        ? orificeDeltaP_bar >= 0.72 * (midPressurePmid_bar_a - 0.9 * c.Pv_bar_a) ||
          c.P2_bar_a <= c.Pv_bar_a
        : orificeDeltaP_bar / Math.max(0.1, midPressurePmid_bar_a) >= 0.5;
    const sharedCavitationResolved =
      c.fluidPhase === 'LIQUID' ? midPressurePmid_bar_a > c.Pv_bar_a && sharedSigma >= 1.3 : true;

    // Aerodynamic / hydrodynamic valve sound power reduction ~ 18*log10(dP_orig / dP_shared)
    const sharedNoiseReduction_dBA = Math.max(
      0,
      16 * Math.log10(Math.max(1, totalDp / sharedValveDeltaP_bar))
    );

    return {
      id: c.id,
      label: c.label,
      originalValveDeltaP_bar: Number(totalDp.toFixed(2)),
      orificeDeltaP_bar: Number(orificeDeltaP_bar.toFixed(2)),
      midPressurePmid_bar_a: Number(midPressurePmid_bar_a.toFixed(2)),
      sharedValveDeltaP_bar: Number(sharedValveDeltaP_bar.toFixed(2)),
      originalSigma: Number(originalSigma.toFixed(2)),
      sharedSigma: Number(sharedSigma.toFixed(2)),
      orificeSigma,
      orificeChokedWarning,
      sharedCavitationResolved,
      sharedNoiseReduction_dBA: Number(sharedNoiseReduction_dBA.toFixed(1)),
    };
  });

  return {
    orificeRatedCv: Number(orificeRatedCv.toFixed(1)),
    equivalentOrificeBore_mm: Number(equivalentOrificeBore_mm.toFixed(1)),
    orificeBetaRatio: Number(orificeBetaRatio.toFixed(2)),
    designMaxCaseLabel: maxCase.label,
    orificeDeltaPAtMax_bar: Number(dPOrfAtMax.toFixed(2)),
    caseShares,
  };
}
