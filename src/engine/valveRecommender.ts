import {
  GENERIC_VALVE_SCHEDULE,
  PRESSURE_CLASSES,
  PressureClassId,
  TrimStyleId,
  BodyStyleId,
  FlowDirectionId,
  computeCorrelatedValveParameters,
  CorrelatedValveParameters,
} from './valveSchedule.ts';
import { OperatingPointInput, PipingConfiguration, evaluateOperatingCase, CaseSizingResult } from './iec60534Sizing.ts';

export interface ValveSelectionRecommendation {
  recommendedDN: number;
  recommendedNPS: string;
  recommendedPressureClass: PressureClassId;
  recommendedRatedCv: number;
  maxRequiredCv: number;
  minRequiredCv: number;
  turndownRatio: number;
  maxPressureBarA: number;
  maxTemperatureDegC: number;
  maxPercentOpen: number;
  minPercentOpen: number;
  rationale: string[];
  /**
   * Sibanda (2022) Chapter 6 Least-Cost Life-Cycle Valve Diameter Optimization Model:
   * C_Total(D) = C_Manufacturing(D) + C_Operating(D)
   */
  sibandaLeastCostDN: number;
  sibandaLeastCostNPS: string;
  sibandaLifeCycleYears: number;
  allSizesFeasible: {
    dn: number;
    nps: string;
    ratedCv: number;
    maxPercentOpen: number;
    minPercentOpen: number;
    isSuitable: boolean;
    reason: string;
    sibandaMaterialCost_GBP: number;
    sibandaActuationCost_GBP: number;
    sibandaProductionCost_GBP: number;
    sibandaManufacturingCost_GBP: number;
    sibandaOperatingEnergyCost_GBP: number;
    sibandaTotalLifeCycleCost_GBP: number;
  }[];
}

/**
 * Evaluates all active operating conditions to select a single valve envelope:
 * 1. Checks max pressure & temperature across conditions to determine minimum required ASME/PN rating.
 * 2. Determines max required Cv to ensure valve operates within standard good engineering practice
 *    (e.g., Max required Cv between 60% and 85% of rated capacity on Linear characteristic).
 * 3. Checks minimum required Cv to verify turndown (e.g. min travel >= 10-15%).
 * 4. Recommends optimal standard DN size and pressure rating.
 */
export function recommendValveSizeAndRating(params: {
  cases: OperatingPointInput[];
  piping: PipingConfiguration;
  trimStyle: TrimStyleId;
  bodyStyle: BodyStyleId;
  flowDirection: FlowDirectionId;
  reducedTrimFactor: number;
  useExtendedStroke: boolean;
  characteristicType?: 'LINEAR' | 'EQUAL_PCT' | 'MODIFIED_EQUAL_PCT' | 'BI_LINEAR' | 'QUICK_OPENING' | 'MODIFIED_PARABOLIC' | 'CUSTOM_SPLINE' | 'AUTO_FIT_CONSTANT_GAIN';
  equalPctRangeability?: number;
}): ValveSelectionRecommendation {
  const activeCases = params.cases.filter((c) => c.enabled);
  const lifeCycleYears = 10;
  if (activeCases.length === 0) {
    return {
      recommendedDN: 80,
      recommendedNPS: '3"',
      recommendedPressureClass: 'CL300_PN40',
      recommendedRatedCv: 144,
      maxRequiredCv: 0,
      minRequiredCv: 0,
      turndownRatio: 1,
      maxPressureBarA: 1,
      maxTemperatureDegC: 20,
      maxPercentOpen: 0,
      minPercentOpen: 0,
      rationale: ['No operating cases active.'],
      sibandaLeastCostDN: 80,
      sibandaLeastCostNPS: '3"',
      sibandaLifeCycleYears: lifeCycleYears,
      allSizesFeasible: [],
    };
  }

  // 1. Evaluate Max Process Pressure & Temperature
  const maxP1 = Math.max(...activeCases.map((c) => c.P1_bar_a));
  const maxT = Math.max(...activeCases.map((c) => c.T1_degC));

  // Nominal case for Sibanda Chapter 6 Operating Energy Cost calculation
  const normalCase =
    activeCases.find((c) => c.label.toLowerCase().includes('norm')) ||
    activeCases[Math.floor(activeCases.length / 2)];
  const Q_m3_h =
    normalCase.fluidPhase === 'LIQUID'
      ? normalCase.flowRate
      : normalCase.fluidPhase === 'STEAM'
      ? normalCase.flowRate / Math.max(1, normalCase.rho_kg_m3 || 15)
      : normalCase.flowRate / 50;
  const Q_L_s = Math.max(0.5, Q_m3_h / 3.6);
  const SG = normalCase.fluidPhase === 'LIQUID' ? (normalCase.rho_kg_m3 || 998) / 1000 : 0.85;

  // Pressure Class Selection logic
  // CL150: max ~19.6 bar at 20°C, drops to ~13 bar at 200°C
  // CL300: max ~51.1 bar at 20°C, drops to ~43 bar at 200°C
  // CL600: max ~102.1 bar at 20°C
  let selectedClass: PressureClassId = 'CL150_PN16';
  if (maxP1 > 100 || (maxP1 > 85 && maxT > 150)) {
    selectedClass = 'CL900_PN160';
  } else if (maxP1 > 48 || (maxP1 > 38 && maxT > 150)) {
    selectedClass = 'CL600_PN100';
  } else if (maxP1 > 16 || (maxP1 > 12 && maxT > 120)) {
    selectedClass = 'CL300_PN40';
  }

  // 2. Perform provisional sizing across candidate DN sizes to find required Cv
  // We test sizes in GENERIC_VALVE_SCHEDULE to calculate exact required Cv per condition
  const candidateEvaluations = GENERIC_VALVE_SCHEDULE.map((sizeSpec) => {
    const valve = computeCorrelatedValveParameters({
      dn: sizeSpec.dn,
      pressureClass: selectedClass,
      bodyStyle: params.bodyStyle,
      trimStyle: params.trimStyle,
      flowDirection: params.flowDirection,
      reducedTrimFactor: params.reducedTrimFactor,
      useExtendedStroke: params.useExtendedStroke,
    });

    const evaluatedCases = activeCases.map((pt) =>
      evaluateOperatingCase({
        point: pt,
        piping: params.piping,
        valveD_mm: valve.d_mm,
        seatPort_mm: valve.d_port_mm,
        ratedCv: valve.ratedCv,
        FL: valve.FL,
        Kc: valve.Kc,
        xT: valve.xT,
        Fd: valve.Fd,
        stages: 1,
        drilledHoleDia_mm: 4.0,
        characteristicType: params.characteristicType || 'LINEAR',
        equalPctRangeability: params.equalPctRangeability || 50,
      })
    );

    const maxCv = Math.max(...evaluatedCases.map((c) => c.requiredCv));
    const minCv = Math.min(...evaluatedCases.map((c) => c.requiredCv));
    const maxPct = (maxCv / valve.ratedCv) * 100;
    const minPct = (minCv / valve.ratedCv) * 100;
    const maxTravelPct = Math.max(...evaluatedCases.map((c) => c.estimatedTravelPct));
    const minTravelPct = Math.min(...evaluatedCases.map((c) => c.estimatedTravelPct));

    // --- SIBANDA (2022) CHAPTER 6 LEAST-COST LIFE-CYCLE MODEL ---
    // Nominal Valve Diameter D in meters
    const D_m = sizeSpec.dn / 1000;
    // Eq. 6.x Manufacturing Cost Regression (£ GBP):
    // Material: M1 = 3834.7 * D + 100.68 (R^2 = 0.9624)
    // Actuation: A1 = 36554 * D - 1080.6 (R^2 = 0.9851)
    // Production: P1 = 1641.8 * D + 350.5 (R^2 = 0.9648)
    const M1_GBP = 3834.7 * D_m + 100.68;
    const A1_GBP = Math.max(240, 36554 * D_m - 1080.6);
    const P1_GBP = 1641.8 * D_m + 350.5;
    const C_mfg_GBP = M1_GBP + A1_GBP + P1_GBP;

    // Unrecovered Valve + Reducer Head Loss h_L(D) in meters at normal flow Q:
    // ΔP_perm (bar) = SG * (Q_m3_h / (0.865 * FP * Cv_rated))^2
    const normEval = evaluatedCases[Math.floor(evaluatedCases.length / 2)] || evaluatedCases[0];
    const kvEffective = Math.max(0.5, 0.865 * normEval.FP * valve.ratedCv);
    const deltaP_unrecovered_bar = SG * Math.pow(Q_m3_h / kvEffective, 2);
    const hL_m = (deltaP_unrecovered_bar * 1e5) / (Math.max(600, SG * 1000) * 9.81);

    // Sibanda Operating Pumping Energy Cost over N_years (U = 0.65 usage, E = 0.75 pump eff, C_elec = £0.12/kWh)
    const C_elec = 0.12;
    const U_usage = 0.65;
    const E_pump = 0.75;
    let C_op_GBP =
      (lifeCycleYears * 1.65 * Q_L_s * hL_m * SG * C_elec * U_usage) / E_pump;

    // Add hydraulic capacity & wire-drawing penalty if valve cannot pass max flow or operates on seat
    if (maxPct > 98) {
      C_op_GBP += 15000 * Math.pow(maxPct / 95, 2);
    } else if (minPct < 6) {
      C_op_GBP += 2500 * ((6 - minPct) / 6);
    }
    const C_total_GBP = C_mfg_GBP + C_op_GBP;

    let isSuitable = false;
    let reason = '';

    // Strict 60%–90% Max Cv Capacity Rule:
    // Max required Cv must be >= 60% and <= 90% of valve's maximum rated Cv
    if (maxPct > 90) {
      reason = `Undersized: Max case requires ${maxPct.toFixed(1)}% of rated Cv (exceeds 90% ceiling)`;
    } else if (maxPct >= 60 && maxPct <= 90) {
      isSuitable = true;
      reason = `Optimal (60–90% Rule): Max Cv at ${maxPct.toFixed(1)}% of rated capacity (${maxTravelPct.toFixed(1)}% open), Min at ${minTravelPct.toFixed(1)}% open`;
    } else if (maxPct >= 40 && maxPct < 60) {
      reason = `Oversized (<60%): Max Cv is ${maxPct.toFixed(1)}% of rated Cv (consider reduced trim factor to bring into 60–90% band)`;
    } else {
      reason = `Oversized: Max Cv is ${maxPct.toFixed(1)}% of rated Cv (< 60% floor)`;
    }

    return {
      dn: sizeSpec.dn,
      nps: sizeSpec.npsLabel,
      ratedCv: valve.ratedCv,
      maxCv,
      minCv,
      maxPct,
      minPct,
      maxTravelPct,
      minTravelPct,
      isSuitable,
      reason,
      sibandaMaterialCost_GBP: Math.round(M1_GBP),
      sibandaActuationCost_GBP: Math.round(A1_GBP),
      sibandaProductionCost_GBP: Math.round(P1_GBP),
      sibandaManufacturingCost_GBP: Math.round(C_mfg_GBP),
      sibandaOperatingEnergyCost_GBP: Math.round(C_op_GBP),
      sibandaTotalLifeCycleCost_GBP: Math.round(C_total_GBP),
    };
  });

  // Pick best size: strictly in [60%, 90%] of rated Cv capacity
  let best = candidateEvaluations.find((c) => c.maxPct >= 60 && c.maxPct <= 90);
  if (!best) {
    // Fallback if DN step jumps over [60%, 90%]: smallest DN where maxPct <= 90%
    best = candidateEvaluations.find((c) => c.maxPct <= 90) || candidateEvaluations[candidateEvaluations.length - 1];
  }

  // Sibanda (2022) Chapter 6 Least-Cost Life-Cycle Optimal DN
  const feasibleForCost = candidateEvaluations.filter((c) => c.maxPct <= 90);
  const leastCostCandidate =
    (feasibleForCost.length > 0 ? feasibleForCost : candidateEvaluations).reduce((prev, curr) =>
      curr.sibandaTotalLifeCycleCost_GBP < prev.sibandaTotalLifeCycleCost_GBP ? curr : prev
    );

  const rationale: string[] = [
    `Step 1–2 (Process & Cv): Evaluated ${activeCases.length} operating conditions; P_max = ${maxP1.toFixed(1)} bar a at T_max = ${maxT}°C, Cv_max = ${best.maxCv.toFixed(1)}.`,
    `Step 3 (Size & Rating, 60–90% Rule): Selected ${PRESSURE_CLASSES[selectedClass].label}, DN${best.dn} (${best.nps}) with rated Cv = ${best.ratedCv} (Cv_max is ${best.maxPct.toFixed(1)}% of rated capacity${best.maxPct < 60 ? ' — <60% due to standard DN step; reduced trim optional' : ''}).`,
    `Step 4 (% Open on ${params.characteristicType || 'LINEAR'}): Operating travel spans ${best.minTravelPct.toFixed(1)}% to ${best.maxTravelPct.toFixed(1)}% open (turndown ${(best.maxCv / Math.max(0.1, best.minCv)).toFixed(1)}:1).`,
    `Sibanda (2022) Ch. 6 Least-Cost Life-Cycle (${lifeCycleYears}-yr Mfg + Pumping Energy): Selected DN${best.dn} = £${best.sibandaTotalLifeCycleCost_GBP.toLocaleString()} (Mfg £${best.sibandaManufacturingCost_GBP.toLocaleString()} + Op £${best.sibandaOperatingEnergyCost_GBP.toLocaleString()}); Economic Minimum = DN${leastCostCandidate.dn} (£${leastCostCandidate.sibandaTotalLifeCycleCost_GBP.toLocaleString()}).`,
  ];

  return {
    recommendedDN: best.dn,
    recommendedNPS: best.nps,
    recommendedPressureClass: selectedClass,
    recommendedRatedCv: best.ratedCv,
    maxRequiredCv: Number(best.maxCv.toFixed(1)),
    minRequiredCv: Number(best.minCv.toFixed(1)),
    turndownRatio: Number((best.maxCv / Math.max(0.1, best.minCv)).toFixed(1)),
    maxPressureBarA: maxP1,
    maxTemperatureDegC: maxT,
    maxPercentOpen: Number(best.maxTravelPct.toFixed(1)),
    minPercentOpen: Number(best.minTravelPct.toFixed(1)),
    rationale,
    sibandaLeastCostDN: leastCostCandidate.dn,
    sibandaLeastCostNPS: leastCostCandidate.nps,
    sibandaLifeCycleYears: lifeCycleYears,
    allSizesFeasible: candidateEvaluations.map((c) => ({
      dn: c.dn,
      nps: c.nps,
      ratedCv: c.ratedCv,
      maxPercentOpen: Number(c.maxPct.toFixed(1)),
      minPercentOpen: Number(c.minPct.toFixed(1)),
      isSuitable: c.isSuitable,
      reason: c.reason,
      sibandaMaterialCost_GBP: c.sibandaMaterialCost_GBP,
      sibandaActuationCost_GBP: c.sibandaActuationCost_GBP,
      sibandaProductionCost_GBP: c.sibandaProductionCost_GBP,
      sibandaManufacturingCost_GBP: c.sibandaManufacturingCost_GBP,
      sibandaOperatingEnergyCost_GBP: c.sibandaOperatingEnergyCost_GBP,
      sibandaTotalLifeCycleCost_GBP: c.sibandaTotalLifeCycleCost_GBP,
    })),
  };
}
