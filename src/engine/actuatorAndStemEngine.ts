export type ShutoffClassId = 'CLASS_II' | 'CLASS_III' | 'CLASS_IV' | 'CLASS_V' | 'CLASS_VI';

export type PackingTypeId =
  | 'SINGLE_PTFE_V_RING'
  | 'DOUBLE_PTFE_LIVE_LOADED'
  | 'GRAPHITE_ULF_LIVE_LOADED'
  | 'HIGH_TEMP_BRAIDED_GRAPHITE';

export type BalanceSealTypeId =
  | 'NONE_METAL_CLEARANCE'
  | 'PTFE_SPRING_ENERGIZED'
  | 'GRAPHITE_PISTON_RING';

export type FailActionId = 'FAIL_CLOSED_ATO' | 'FAIL_OPEN_ATC';

export type StemMaterialId =
  | 'SS316TI_CW'
  | 'XM19_NITRONIC50'
  | 'PH17_4_H1150M'
  | 'INCONEL_718'
  | 'HASTELLOY_C276';

export interface StemMaterialSpec {
  id: StemMaterialId;
  name: string;
  unsCode: string;
  Sy_20C_MPa: number;
  Sm_20C_MPa: number;
  E_20C_GPa: number;
  shearAllowable_MPa: number;
}

export const STEM_MATERIALS: Record<StemMaterialId, StemMaterialSpec> = {
  SS316TI_CW: {
    id: 'SS316TI_CW',
    name: '316Ti / 316L Cold-Worked Strain-Hardened Bar',
    unsCode: 'UNS S31635 / 1.4571',
    Sy_20C_MPa: 310,
    Sm_20C_MPa: 155,
    E_20C_GPa: 193,
    shearAllowable_MPa: 95,
  },
  XM19_NITRONIC50: {
    id: 'XM19_NITRONIC50',
    name: 'Nitronic 50 (XM-19 High-Strength Austenitic)',
    unsCode: 'UNS S20910',
    Sy_20C_MPa: 515,
    Sm_20C_MPa: 235,
    E_20C_GPa: 198,
    shearAllowable_MPa: 140,
  },
  PH17_4_H1150M: {
    id: 'PH17_4_H1150M',
    name: '17-4 PH Stainless (H1150M NACE)',
    unsCode: 'UNS S17400',
    Sy_20C_MPa: 585,
    Sm_20C_MPa: 245,
    E_20C_GPa: 197,
    shearAllowable_MPa: 150,
  },
  INCONEL_718: {
    id: 'INCONEL_718',
    name: 'Alloy 718 (Inconel 718 High-Temp Stem)',
    unsCode: 'UNS N07718',
    Sy_20C_MPa: 1035,
    Sm_20C_MPa: 345,
    E_20C_GPa: 204,
    shearAllowable_MPa: 210,
  },
  HASTELLOY_C276: {
    id: 'HASTELLOY_C276',
    name: 'Alloy C-276 (Hastelloy C-276)',
    unsCode: 'UNS N10276',
    Sy_20C_MPa: 355,
    Sm_20C_MPa: 188,
    E_20C_GPa: 205,
    shearAllowable_MPa: 115,
  },
};

export const STANDARD_METRIC_STEM_DIAMETERS_MM = [
  10, 12, 16, 20, 25, 32, 40, 50, 60, 75, 85,
];

export interface ActuatorAndStemInput {
  seatPortDia_mm: number; // d_port (mm)
  cageGuideDia_mm: number; // D_cage (mm)
  selectedStemDia_mm: number; // d_stem (mm)
  unsupportedStemLength_mm: number; // L_unsupported (mm)
  stroke_mm: number; // H (mm)
  shutoffDeltaP_bar: number; // Max shutoff dP (bar)
  downstreamShutoffP2_bar_g: number; // P2 gauge (bar g)
  operatingTemp_degC: number;
  flowDirection: 'FTO' | 'FTC';
  shutoffClass: ShutoffClassId;
  packingType: PackingTypeId;
  balanceSealType: BalanceSealTypeId;
  hasMetallicBellows: boolean;
  bellowsEffectiveArea_cm2: number;
  bellowsSpringRate_N_mm: number;
  // Pneumatic Diaphragm / Piston Actuator parameters
  failAction: FailActionId;
  actuatorEffectiveArea_cm2: number; // e.g., 280, 530, 1000, 1500 cm2
  airSupplyPressure_bar_g: number; // e.g., 4.0 bar g (58 psig)
  benchSetLower_bar_g: number; // e.g., 0.8 bar g
  benchSetUpper_bar_g: number; // e.g., 2.4 bar g
  stemMaterial: StemMaterialId;
}

export interface PlugForceBreakdown {
  fluidUnbalanceForceA_N: number;
  seatLoadForceB_N: number;
  packingFrictionForceC_N: number;
  sealAndBellowsForceD_N: number;
  totalRequiredThrust_N: number;
  totalWithSafetyMargin_N: number; // 1.25x margin
}

export interface ActuatorAndStemResult {
  unbalanced: PlugForceBreakdown;
  balanced: PlugForceBreakdown;
  thrustReductionPct: number;
  activeMode: 'UNBALANCED' | 'BALANCED';
  // Pneumatic Bench Set & Actuator Verification
  availableActuatorSeatingThrust_N: number;
  availableActuatorOpenThrust_N: number;
  requiredMinBenchLower_bar_g: number;
  requiredMinSupplyAir_bar_g: number;
  actuatorMarginUnbalancedPct: number;
  actuatorMarginBalancedPct: number;
  recommendedActuatorArea_cm2: number;
  // Stem Structural Sizing (Tensile Root, Compressive Yield, Euler Buckling)
  selectedStemDia_mm: number;
  rootThreadDia_mm: number;
  directTensileStress_MPa: number;
  allowableTensileSm_MPa: number;
  directCompressiveStress_MPa: number;
  allowableCompressive_MPa: number;
  slendernessRatioKL_r: number;
  eulerCriticalBucklingLoad_N: number;
  bucklingSafetyFactor: number;
  minRequiredStemDia_mm: number;
  recommendedStandardStem_mm: number;
  stemStructuralStatus: 'PASS' | 'WARNING' | 'CRITICAL';
}

/**
 * Evaluates Balanced vs. Unbalanced Plug Thrust (F_total = A + B + C + D per Emerson Ch. 5.11 & Skousen Ch. 8),
 * ANSI/FCI 70-2 Seat Loads, Pneumatic Actuator Bench Set Margins, and Stem Diameter / Euler Buckling Sizing.
 */
export function evaluateActuatorAndStemSizing(
  input: ActuatorAndStemInput
): ActuatorAndStemResult {
  const d_seat_mm = Math.max(10, input.seatPortDia_mm);
  const D_cage_mm = Math.max(d_seat_mm + 2, input.cageGuideDia_mm);
  const d_stem_mm = Math.max(8, input.selectedStemDia_mm);

  const A_seat_mm2 = (Math.PI / 4) * d_seat_mm * d_seat_mm;
  const A_stem_mm2 = (Math.PI / 4) * d_stem_mm * d_stem_mm;

  const dP_MPa = Math.max(0.05, input.shutoffDeltaP_bar * 0.1); // 1 bar = 0.1 N/mm2 (MPa)
  const P2_MPa = Math.max(0, input.downstreamShutoffP2_bar_g * 0.1);
  const P1_MPa = P2_MPa + dP_MPa;

  // 1. Force A: Fluid Static Pressure Unbalance (N)
  // Unbalanced Plug: Full port area A_seat exposed to dP + stem area rejection
  const forceA_unbalanced_N = Math.round(
    A_seat_mm2 * dP_MPa + A_stem_mm2 * P1_MPa
  );

  // Balanced Cage-Guided Plug: Equalizing holes balance top & bottom of plug head;
  // only the small annular balance-seal step area (~4% of seat area) + stem area remains unbalanced!
  const A_unbalancedAnnulus_mm2 =
    (Math.PI / 4) * (Math.pow(D_cage_mm, 2) - Math.pow(d_seat_mm, 2)) * 0.35;
  const forceA_balanced_N = Math.round(
    A_unbalancedAnnulus_mm2 * dP_MPa + A_stem_mm2 * P2_MPa
  );

  // 2. Force B: ANSI/FCI 70-2 / IEC 60534-4 Seat Line Contact Load (N/mm of seat circumference)
  const seatCircumference_mm = Math.PI * d_seat_mm;
  const seatSpecificLoad_N_per_mm: Record<ShutoffClassId, number> = {
    CLASS_II: 3.5, // Balanced metal ring low seat load
    CLASS_III: 6.5,
    CLASS_IV: 14.0, // Standard metal-to-metal shutoff (~80 lb/linear inch)
    CLASS_V: 56.0, // High-pressure tight metal seat (~320 lb/linear inch + dP term)
    CLASS_VI: 22.0, // Elastomer / PTFE soft seat resilient compression
  };
  const baseSeatLineLoad = seatSpecificLoad_N_per_mm[input.shutoffClass] || 14.0;
  const classVPressureBoost =
    input.shutoffClass === 'CLASS_V' ? 0.18 * input.shutoffDeltaP_bar * seatCircumference_mm : 0;
  const forceB_seat_N = Math.round(
    seatCircumference_mm * baseSeatLineLoad + classVPressureBoost
  );

  // 3. Force C: Stem Packing Friction (Emerson Table 5.4 / 5.5)
  // Scales with stem diameter and pressure class
  const packingSpecificFriction_N_per_mmStem: Record<PackingTypeId, number> = {
    SINGLE_PTFE_V_RING: 28,
    DOUBLE_PTFE_LIVE_LOADED: 45,
    GRAPHITE_ULF_LIVE_LOADED: 95,
    HIGH_TEMP_BRAIDED_GRAPHITE: 140,
  };
  const forceC_packing_N = Math.round(
    d_stem_mm * (packingSpecificFriction_N_per_mmStem[input.packingType] || 45)
  );

  // 4. Force D: Balance Seal Ring Drag & Metallic Bellows Stiffness/Pressure Thrust
  let bellowsForce_N = 0;
  if (input.hasMetallicBellows) {
    const A_bellows_mm2 = Math.max(A_stem_mm2 * 2, input.bellowsEffectiveArea_cm2 * 100);
    bellowsForce_N =
      A_bellows_mm2 * P1_MPa + input.bellowsSpringRate_N_mm * input.stroke_mm;
  }

  const sealRingDrag_N_per_mmCircumference: Record<BalanceSealTypeId, number> = {
    NONE_METAL_CLEARANCE: 0.5,
    PTFE_SPRING_ENERGIZED: 4.2,
    GRAPHITE_PISTON_RING: 8.5,
  };
  const cageCircumference_mm = Math.PI * D_cage_mm;
  const balanceRingDrag_N =
    cageCircumference_mm * (sealRingDrag_N_per_mmCircumference[input.balanceSealType] || 4.2);

  const forceD_unbalanced_N = Math.round(bellowsForce_N);
  const forceD_balanced_N = Math.round(bellowsForce_N + balanceRingDrag_N);

  const totalUnbalanced_N =
    forceA_unbalanced_N + forceB_seat_N + forceC_packing_N + forceD_unbalanced_N;
  const totalBalanced_N =
    forceA_balanced_N + forceB_seat_N + forceC_packing_N + forceD_balanced_N;

  const unbalanced: PlugForceBreakdown = {
    fluidUnbalanceForceA_N: forceA_unbalanced_N,
    seatLoadForceB_N: forceB_seat_N,
    packingFrictionForceC_N: forceC_packing_N,
    sealAndBellowsForceD_N: forceD_unbalanced_N,
    totalRequiredThrust_N: totalUnbalanced_N,
    totalWithSafetyMargin_N: Math.round(totalUnbalanced_N * 1.25),
  };

  const balanced: PlugForceBreakdown = {
    fluidUnbalanceForceA_N: forceA_balanced_N,
    seatLoadForceB_N: forceB_seat_N,
    packingFrictionForceC_N: forceC_packing_N,
    sealAndBellowsForceD_N: forceD_balanced_N,
    totalRequiredThrust_N: totalBalanced_N,
    totalWithSafetyMargin_N: Math.round(totalBalanced_N * 1.25),
  };

  const thrustReductionPct = Number(
    (
      ((totalUnbalanced_N - totalBalanced_N) / Math.max(1, totalUnbalanced_N)) *
      100
    ).toFixed(1)
  );

  // 5. Pneumatic Diaphragm / Piston Actuator Bench Set & Supply Air Verification
  // 1 cm2 * 1 bar = 10 N
  const A_eff_cm2 = Math.max(50, input.actuatorEffectiveArea_cm2);
  const P_bench_low = Math.max(0.2, input.benchSetLower_bar_g);
  const P_bench_high = Math.max(P_bench_low + 0.4, input.benchSetUpper_bar_g);
  const P_supply = Math.max(P_bench_high + 0.4, input.airSupplyPressure_bar_g);

  let availableActuatorSeatingThrust_N = 0;
  let availableActuatorOpenThrust_N = 0;

  if (input.failAction === 'FAIL_CLOSED_ATO') {
    // Spring-to-Close (Fail Closed): Seating thrust at 0 signal comes from initial spring compression P_bench_low
    availableActuatorSeatingThrust_N = Math.round(A_eff_cm2 * P_bench_low * 10);
    availableActuatorOpenThrust_N = Math.round(
      A_eff_cm2 * (P_supply - P_bench_high) * 10
    );
  } else {
    // Air-to-Close (Fail Open): Seating thrust at full supply air comes from (P_supply - P_bench_high)
    availableActuatorSeatingThrust_N = Math.round(
      A_eff_cm2 * (P_supply - P_bench_high) * 10
    );
    availableActuatorOpenThrust_N = Math.round(A_eff_cm2 * P_bench_low * 10);
  }

  const activeMode =
    availableActuatorSeatingThrust_N >= unbalanced.totalWithSafetyMargin_N
      ? 'UNBALANCED'
      : 'BALANCED';

  const designThrust_N =
    d_seat_mm >= 65 && input.shutoffDeltaP_bar >= 12
      ? balanced.totalWithSafetyMargin_N
      : unbalanced.totalWithSafetyMargin_N;

  const requiredMinBenchLower_bar_g = Number(
    (designThrust_N / (A_eff_cm2 * 10)).toFixed(2)
  );
  const requiredMinSupplyAir_bar_g = Number(
    (P_bench_high + designThrust_N / (A_eff_cm2 * 10)).toFixed(2)
  );

  const actuatorMarginUnbalancedPct = Number(
    (
      ((availableActuatorSeatingThrust_N - unbalanced.totalWithSafetyMargin_N) /
        Math.max(1, unbalanced.totalWithSafetyMargin_N)) *
      100
    ).toFixed(1)
  );
  const actuatorMarginBalancedPct = Number(
    (
      ((availableActuatorSeatingThrust_N - balanced.totalWithSafetyMargin_N) /
        Math.max(1, balanced.totalWithSafetyMargin_N)) *
      100
    ).toFixed(1)
  );

  const effectivePressureDelta_bar =
    input.failAction === 'FAIL_CLOSED_ATO' ? P_bench_low : P_supply - P_bench_high;
  const recommendedActuatorArea_cm2 = Math.ceil(
    designThrust_N / Math.max(2, effectivePressureDelta_bar * 10) / 50
  ) * 50;

  // 6. Operational Stem Diameter & Euler Buckling Sizing
  const stemSpec = STEM_MATERIALS[input.stemMaterial] || STEM_MATERIALS.XM19_NITRONIC50;
  const tempDerate =
    input.operatingTemp_degC > 50
      ? Math.max(0.55, 1 - 0.00065 * (input.operatingTemp_degC - 50))
      : 1.0;

  const Sm_stem_MPa = Number((stemSpec.Sm_20C_MPa * tempDerate).toFixed(1));
  const Sy_stem_MPa = Number((stemSpec.Sy_20C_MPa * tempDerate).toFixed(1));
  const E_stem_MPa = stemSpec.E_20C_GPa * 1000 * tempDerate;

  // Max axial load on stem is the maximum of designThrust_N and available actuator stall thrust
  const maxAxialStemLoad_N = Math.max(
    unbalanced.totalWithSafetyMargin_N,
    availableActuatorSeatingThrust_N * 1.15
  );

  // Thread root / cross-pin net diameter (~0.82 * d_stem)
  const rootThreadDia_mm = Number((0.82 * d_stem_mm).toFixed(2));
  const A_root_mm2 = (Math.PI / 4) * rootThreadDia_mm * rootThreadDia_mm;

  const directTensileStress_MPa = Number(
    (maxAxialStemLoad_N / Math.max(1, A_root_mm2)).toFixed(1)
  );
  const directCompressiveStress_MPa = Number(
    (maxAxialStemLoad_N / Math.max(1, A_stem_mm2)).toFixed(1)
  );
  const allowableCompressive_MPa = Number((0.67 * Sy_stem_MPa).toFixed(1));

  // Euler Column Buckling: P_cr = (pi^2 * E * I) / (K * L_u)^2
  // I = (pi / 64) * d^4, r_gyration = d / 4, K_eff = 0.80 (guided packing gland + yoke coupling)
  const K_buckling = 0.80;
  const L_u_mm = Math.max(60, input.unsupportedStemLength_mm);
  const KL_mm = K_buckling * L_u_mm;
  const r_gyration_mm = d_stem_mm / 4;
  const slendernessRatioKL_r = Number((KL_mm / r_gyration_mm).toFixed(1));

  const I_stem_mm4 = (Math.PI / 64) * Math.pow(d_stem_mm, 4);
  const eulerCriticalBucklingLoad_N = Math.round(
    (Math.PI * Math.PI * E_stem_MPa * I_stem_mm4) / (KL_mm * KL_mm)
  );
  const bucklingSafetyFactor = Number(
    (eulerCriticalBucklingLoad_N / Math.max(1, maxAxialStemLoad_N)).toFixed(2)
  );

  // Minimum required stem diameter across Tensile, Compressive, and Euler Buckling (SF >= 2.5)
  const dMinTensile_mm =
    Math.sqrt((4 * maxAxialStemLoad_N) / (Math.PI * Sm_stem_MPa)) / 0.82;
  const dMinComp_mm = Math.sqrt(
    (4 * maxAxialStemLoad_N) / (Math.PI * allowableCompressive_MPa)
  );
  const dMinBuckling_mm = Math.pow(
    (64 * 2.5 * maxAxialStemLoad_N * KL_mm * KL_mm) /
      (Math.PI * Math.PI * Math.PI * E_stem_MPa),
    0.25
  );

  const minRequiredStemDia_mm = Number(
    Math.max(8.0, dMinTensile_mm, dMinComp_mm, dMinBuckling_mm).toFixed(1)
  );
  const recommendedStandardStem_mm =
    STANDARD_METRIC_STEM_DIAMETERS_MM.find((d) => d >= minRequiredStemDia_mm) || 85;

  let stemStructuralStatus: 'PASS' | 'WARNING' | 'CRITICAL' = 'PASS';
  if (
    directTensileStress_MPa > Sm_stem_MPa ||
    directCompressiveStress_MPa > allowableCompressive_MPa ||
    bucklingSafetyFactor < 2.0 ||
    d_stem_mm < minRequiredStemDia_mm
  ) {
    stemStructuralStatus = 'CRITICAL';
  } else if (
    bucklingSafetyFactor < 2.5 ||
    directTensileStress_MPa > 0.8 * Sm_stem_MPa
  ) {
    stemStructuralStatus = 'WARNING';
  }

  return {
    unbalanced,
    balanced,
    thrustReductionPct,
    activeMode,
    availableActuatorSeatingThrust_N,
    availableActuatorOpenThrust_N,
    requiredMinBenchLower_bar_g,
    requiredMinSupplyAir_bar_g,
    actuatorMarginUnbalancedPct,
    actuatorMarginBalancedPct,
    recommendedActuatorArea_cm2,
    selectedStemDia_mm: d_stem_mm,
    rootThreadDia_mm,
    directTensileStress_MPa,
    allowableTensileSm_MPa: Sm_stem_MPa,
    directCompressiveStress_MPa,
    allowableCompressive_MPa,
    slendernessRatioKL_r,
    eulerCriticalBucklingLoad_N,
    bucklingSafetyFactor,
    minRequiredStemDia_mm,
    recommendedStandardStem_mm,
    stemStructuralStatus,
  };
}
