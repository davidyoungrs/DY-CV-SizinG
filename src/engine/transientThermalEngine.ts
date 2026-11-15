export type ThermalAlloyId =
  | 'WCB_CARBON_STEEL'
  | 'WC9_CR_MO'
  | 'CF8M_316SS'
  | 'SS410_MARTENSITIC'
  | 'PH17_4'
  | 'INCONEL_718'
  | 'HASTELLOY_C276'
  | 'ALUMINUM_5083_CRYO';

export interface ThermalAlloySpec {
  id: ThermalAlloyId;
  name: string;
  alpha_1e6_per_K: number; // Mean CTE (um/m·K)
  density_kg_m3: number;
  cp_J_kgK: number;
  k_W_mK: number;
}

export const THERMAL_ALLOYS: Record<ThermalAlloyId, ThermalAlloySpec> = {
  WCB_CARBON_STEEL: {
    id: 'WCB_CARBON_STEEL',
    name: 'ASTM A216 WCB / A105 Carbon Steel',
    alpha_1e6_per_K: 12.1,
    density_kg_m3: 7850,
    cp_J_kgK: 486,
    k_W_mK: 48.0,
  },
  WC9_CR_MO: {
    id: 'WC9_CR_MO',
    name: 'ASTM A217 WC9 / F22 (2.25Cr-1Mo)',
    alpha_1e6_per_K: 12.5,
    density_kg_m3: 7830,
    cp_J_kgK: 475,
    k_W_mK: 38.5,
  },
  CF8M_316SS: {
    id: 'CF8M_316SS',
    name: 'ASTM A351 CF8M / 316Ti / 316L SS',
    alpha_1e6_per_K: 16.5,
    density_kg_m3: 7980,
    cp_J_kgK: 500,
    k_W_mK: 16.2,
  },
  SS410_MARTENSITIC: {
    id: 'SS410_MARTENSITIC',
    name: '410 / CA6NM Martensitic Stainless',
    alpha_1e6_per_K: 11.2,
    density_kg_m3: 7750,
    cp_J_kgK: 460,
    k_W_mK: 24.9,
  },
  PH17_4: {
    id: 'PH17_4',
    name: '17-4 PH Stainless (UNS S17400)',
    alpha_1e6_per_K: 10.9,
    density_kg_m3: 7800,
    cp_J_kgK: 460,
    k_W_mK: 18.4,
  },
  INCONEL_718: {
    id: 'INCONEL_718',
    name: 'Alloy 718 / Inconel 625',
    alpha_1e6_per_K: 13.0,
    density_kg_m3: 8190,
    cp_J_kgK: 435,
    k_W_mK: 11.4,
  },
  HASTELLOY_C276: {
    id: 'HASTELLOY_C276',
    name: 'Hastelloy C-276 / C-22 (UNS N10276)',
    alpha_1e6_per_K: 12.4,
    density_kg_m3: 8890,
    cp_J_kgK: 427,
    k_W_mK: 11.5,
  },
  ALUMINUM_5083_CRYO: {
    id: 'ALUMINUM_5083_CRYO',
    name: 'Aluminum 5083-O (Cryogenic Cold-Box)',
    alpha_1e6_per_K: 22.8,
    density_kg_m3: 2660,
    cp_J_kgK: 900,
    k_W_mK: 117.0,
  },
};

export interface TransientThermalInput {
  plugGuideNominalDia_mm: number; // D_plug (mm)
  cageSleeveHeight_mm: number; // L_sleeve (mm)
  bodyMinWall_mm: number; // t_body (mm)
  cageWall_mm: number; // t_cage (mm)
  coldRadialClearance_mm: number; // c_radial,0 at 20°C (mm)
  axialGasketCrushAllowance_mm: number; // Max elastic/plastic gasket recovery (mm)
  plugAlloy: ThermalAlloyId;
  cageAlloy: ThermalAlloyId;
  bodyAlloy: ThermalAlloyId;
  initialTemp_degC: number; // T_0 (°C)
  finalProcessTemp_degC: number; // T_inf (°C)
  rampRate_degC_per_min: number; // Fluid warmup/cooldown rate (0 = instant step shock)
  convectiveHeatTransferCoeff_W_m2K: number; // h_conv (~2500 liquid/steam, ~400 gas)
  requireLethalBellowsSeal: boolean;
  cageHasHardFacing?: boolean;
}

export interface ThermalTimeStepPoint {
  time_s: number;
  T_fluid_degC: number;
  T_plug_degC: number;
  T_cage_degC: number;
  T_body_degC: number;
  radialClearance_mm: number;
  axialInterference_mm: number;
}

export interface BonnetRecommendation {
  recommendedBonnetStyle:
    | 'STANDARD_BONNET'
    | 'EXTENDED_FINNED_BONNET'
    | 'CRYOGENIC_EXTENSION_BONNET'
    | 'METALLIC_BELLOWS_SEAL_BONNET';
  bonnetTitle: string;
  estimatedPackingBoxTemp_degC: number;
  recommendedPackingSystem: string;
  bonnetRationale: string;
}

export interface TransientThermalResult {
  timeSeries: ThermalTimeStepPoint[];
  tauPlug_s: number;
  tauCage_s: number;
  tauBody_s: number;
  steadyStateRadialClearance_mm: number;
  minTransientRadialClearance_mm: number;
  timeOfMinClearance_s: number;
  minSafeRadialClearanceFloor_mm: number; // 0.15 mm high-temp rule, 0.08 mm ambient
  maxAxialDifferentialExpansion_mm: number;
  recommendedColdRadialClearance_mm: number;
  maxSafeRampRate_degC_per_min: number;
  radialBindingRisk: 'PASS' | 'WARNING' | 'CRITICAL';
  axialCrushRisk: 'PASS' | 'WARNING' | 'CRITICAL';
  gallingRisk: 'PASS' | 'WARNING' | 'CRITICAL';
  gallingRationale: string;
  bonnetAdvisor: BonnetRecommendation;
}

/**
 * Simulates Lumped-Capacitance Transient Thermal Lag T_plug(t), T_cage(t), T_body(t)
 * during rapid hot shocks, cold-slug injections, or startup ramps, and evaluates
 * Radial Guide Clearance Pinch-Points & Axial Sleeve-in-Body Stack Crush.
 */
export function simulateTransientThermalBinding(
  input: TransientThermalInput
): TransientThermalResult {
  const plugSpec = THERMAL_ALLOYS[input.plugAlloy];
  const cageSpec = THERMAL_ALLOYS[input.cageAlloy];
  const bodySpec = THERMAL_ALLOYS[input.bodyAlloy];

  const h_conv = Math.max(80, input.convectiveHeatTransferCoeff_W_m2K);
  const t_cage_m = Math.max(0.004, input.cageWall_mm / 1000);
  const t_body_m = Math.max(0.008, input.bodyMinWall_mm / 1000);
  const r_plug_m = Math.max(0.008, input.plugGuideNominalDia_mm / 2000);

  // Characteristic lumped-capacitance thermal time constants tau_i = (rho * cp * L_char) / h_eff
  // Cage sleeve is perforated and bathed on both ID and OD by high-velocity jet flow (fastest response)
  const L_char_cage = t_cage_m * 0.42;
  // Plug head/skirt is bathed primarily on outer/bottom contour (medium response)
  const L_char_plug = Math.min(0.022, r_plug_m * 0.38);
  // Heavy pressure-boundary valve body has thick walls and external ambient loss (slowest response)
  const L_char_body = t_body_m * 1.45;

  const tauCage_s = Number(
    Math.max(3, (cageSpec.density_kg_m3 * cageSpec.cp_J_kgK * L_char_cage) / (h_conv * 1.25)).toFixed(1)
  );
  const tauPlug_s = Number(
    Math.max(5, (plugSpec.density_kg_m3 * plugSpec.cp_J_kgK * L_char_plug) / (h_conv * 0.85)).toFixed(1)
  );
  const tauBody_s = Number(
    Math.max(25, (bodySpec.density_kg_m3 * bodySpec.cp_J_kgK * L_char_body) / (h_conv * 0.32)).toFixed(1)
  );

  const T0 = input.initialTemp_degC;
  const T_final = input.finalProcessTemp_degC;
  const deltaT_total = T_final - T0;
  const rampRate_degC_per_s =
    input.rampRate_degC_per_min > 0 ? input.rampRate_degC_per_min / 60 : 9999;

  const r_nom_mm = Math.max(7.5, input.plugGuideNominalDia_mm / 2);
  const L_sleeve_mm = Math.max(25, input.cageSleeveHeight_mm);

  const maxSimTime_s = Math.min(1800, Math.max(300, Math.round(tauBody_s * 4.5)));
  const numSteps = 120;
  const dt = maxSimTime_s / numSteps;

  let T_plug = T0;
  let T_cage = T0;
  let T_body = T0;

  const timeSeries: ThermalTimeStepPoint[] = [];
  let minTransientRadialClearance_mm = input.coldRadialClearance_mm;
  let timeOfMinClearance_s = 0;
  let maxAxialDifferentialExpansion_mm = 0;

  for (let i = 0; i <= numSteps; i++) {
    const t = Number((i * dt).toFixed(1));
    let T_fluid = T_final;
    if (rampRate_degC_per_s < 5000 && Math.abs(deltaT_total) > 0.1) {
      const sign = deltaT_total >= 0 ? 1 : -1;
      const ramped = T0 + sign * rampRate_degC_per_s * t;
      T_fluid = sign > 0 ? Math.min(T_final, ramped) : Math.max(T_final, ramped);
    }

    if (i > 0) {
      // Exact exponential update over dt for each lumped thermal mass
      T_plug = T_fluid + (T_plug - T_fluid) * Math.exp(-dt / tauPlug_s);
      T_cage = T_fluid + (T_cage - T_fluid) * Math.exp(-dt / tauCage_s);
      T_body = T_fluid + (T_body - T_fluid) * Math.exp(-dt / tauBody_s);
    }

    // Radial growth of plug OD vs cage ID relative to 20°C reference
    const dR_plug_mm =
      r_nom_mm * (plugSpec.alpha_1e6_per_K * 1e-6) * (T_plug - 20);
    const dR_cage_mm =
      r_nom_mm * (cageSpec.alpha_1e6_per_K * 1e-6) * (T_cage - 20);
    const c_radial_mm = input.coldRadialClearance_mm + (dR_cage_mm - dR_plug_mm);

    // Axial expansion of trapped cage sleeve vs valve body bonnet cavity relative to 20°C
    const dL_cage_mm =
      L_sleeve_mm * (cageSpec.alpha_1e6_per_K * 1e-6) * (T_cage - 20);
    const dL_body_mm =
      L_sleeve_mm * (bodySpec.alpha_1e6_per_K * 1e-6) * (T_body - 20);
    const axialDiff_mm = Math.max(0, dL_cage_mm - dL_body_mm);

    if (c_radial_mm < minTransientRadialClearance_mm) {
      minTransientRadialClearance_mm = c_radial_mm;
      timeOfMinClearance_s = t;
    }
    if (axialDiff_mm > maxAxialDifferentialExpansion_mm) {
      maxAxialDifferentialExpansion_mm = axialDiff_mm;
    }

    timeSeries.push({
      time_s: t,
      T_fluid_degC: Number(T_fluid.toFixed(1)),
      T_plug_degC: Number(T_plug.toFixed(1)),
      T_cage_degC: Number(T_cage.toFixed(1)),
      T_body_degC: Number(T_body.toFixed(1)),
      radialClearance_mm: Number(c_radial_mm.toFixed(3)),
      axialInterference_mm: Number(axialDiff_mm.toFixed(3)),
    });
  }

  const steadyStateRadialClearance_mm =
    timeSeries[timeSeries.length - 1].radialClearance_mm;

  const isHighTemp = Math.max(Math.abs(T0), Math.abs(T_final)) >= 250;
  const minSafeRadialClearanceFloor_mm = isHighTemp ? 0.15 : 0.08;

  const clearanceDeficit = Math.max(
    0,
    minSafeRadialClearanceFloor_mm - minTransientRadialClearance_mm
  );
  const recommendedColdRadialClearance_mm = Number(
    Math.max(
      minSafeRadialClearanceFloor_mm + 0.04,
      input.coldRadialClearance_mm + clearanceDeficit + 0.02
    ).toFixed(3)
  );

  // Estimate maximum safe warmup ramp rate (°C/min) to avoid pinching below floor
  const maxSafeRampRate_degC_per_min =
    minTransientRadialClearance_mm >= minSafeRadialClearanceFloor_mm
      ? 120
      : Number(
          Math.max(
            3.5,
            18 *
              (input.coldRadialClearance_mm /
                Math.max(0.05, input.coldRadialClearance_mm - minTransientRadialClearance_mm + 0.1))
          ).toFixed(1)
        );

  const radialBindingRisk: 'PASS' | 'WARNING' | 'CRITICAL' =
    minTransientRadialClearance_mm <= 0.03
      ? 'CRITICAL'
      : minTransientRadialClearance_mm < minSafeRadialClearanceFloor_mm
      ? 'WARNING'
      : 'PASS';

  const axialCrushRisk: 'PASS' | 'WARNING' | 'CRITICAL' =
    maxAxialDifferentialExpansion_mm > input.axialGasketCrushAllowance_mm
      ? 'CRITICAL'
      : maxAxialDifferentialExpansion_mm > input.axialGasketCrushAllowance_mm * 0.75
      ? 'WARNING'
      : 'PASS';

  // Bonnet Style & Packing Box Thermal Isolation Advisor (Emerson Ch. 3 & 6 / Skousen Ch. 2 & 9)
  const T_max = Math.max(T0, T_final);
  const T_min = Math.min(T0, T_final);

  // Trim Sliding Galling & Hardness Differential Check
  let gallingRisk: 'PASS' | 'WARNING' | 'CRITICAL' = 'PASS';
  let gallingRationale =
    'Dissimilar plug/cage alloy pair or hard-faced guide surface provides reliable anti-galling resistance.';

  if (input.plugAlloy === 'CF8M_316SS' && input.cageAlloy === 'CF8M_316SS' && !input.cageHasHardFacing) {
    gallingRisk = 'CRITICAL';
    gallingRationale =
      'Self-mated austenitic 316SS/CF8M plug running in un-hardfaced 316SS cage is highly prone to adhesive galling and seizure. Specify Stellite 6 plug overlay, Cr-HF cage bore, or martensitic 410/17-4PH cage.';
  } else if (
    input.plugAlloy === input.cageAlloy &&
    (T_max >= 250 || input.plugAlloy === 'HASTELLOY_C276') &&
    !input.cageHasHardFacing
  ) {
    gallingRisk = 'WARNING';
    gallingRationale = `Same-alloy plug & cage pair (${plugSpec.name}) at ${T_max}°C without hard-facing: ensure ≥5–10 HRC hardness differential (e.g., Stellite 6 guide lands or nitriding) to prevent scoring.`;
  } else if (input.cageHasHardFacing) {
    gallingRisk = 'PASS';
    gallingRationale = `Hard-faced cage bore / CoCr-A trim provides high hardness differential against ${plugSpec.name} plug up to ${T_max}°C.`;
  }

  let bonnetAdvisor: BonnetRecommendation;

  if (input.requireLethalBellowsSeal) {
    bonnetAdvisor = {
      recommendedBonnetStyle: 'METALLIC_BELLOWS_SEAL_BONNET',
      bonnetTitle: 'Multi-Ply Metallic Bellows Seal Bonnet + Secondary Witness Packing',
      estimatedPackingBoxTemp_degC: Number((25 + 0.42 * (T_max - 25)).toFixed(0)),
      recommendedPackingSystem:
        'Hydroformed Alloy C-276 / 316Ti Bellows + Live-Loaded PTFE/Graphite Backup Gland',
      bonnetRationale:
        'Mandatory zero-fugitive-emission primary stem seal for lethal/toxic fluids (e.g., Liquid Chlorine per Euro Chlor GEST 17/492).',
    };
  } else if (T_min < -29) {
    bonnetAdvisor = {
      recommendedBonnetStyle: 'CRYOGENIC_EXTENSION_BONNET',
      bonnetTitle: 'Cryogenic Cold-Box Extension Bonnet (Stainless Vapor-Column Neck)',
      estimatedPackingBoxTemp_degC: Number(Math.max(5, 20 + 0.08 * T_min).toFixed(0)),
      recommendedPackingSystem: 'Live-Loaded Virgin PTFE V-Ring / Chevron Packing',
      bonnetRationale: `Process temperature (${T_min} °C) is below -29 °C. Long austenitic extension neck maintains a stagnant gas vapor barrier so the packing box stays > 0 °C (preventing ice crystal scoring).`,
    };
  } else if (T_max > 232) {
    const finnedTemp = Number((35 + 0.46 * (T_max - 35)).toFixed(0));
    bonnetAdvisor = {
      recommendedBonnetStyle: 'EXTENDED_FINNED_BONNET',
      bonnetTitle: 'Extended / Radiation-Finned High-Temperature Bonnet',
      estimatedPackingBoxTemp_degC: finnedTemp,
      recommendedPackingSystem:
        T_max > 315
          ? 'Braided + Die-Formed Flexible Graphite ULF with Anti-Extrusion Carbon Bushings'
          : 'Live-Loaded Graphite ULF or High-Temp Glass-Filled PTFE',
      bonnetRationale: `Process temperature (${T_max} °C) exceeds the 232 °C (450 °F) PTFE limit. Extended finned bonnet dissipates heat so the packing box operates around ${finnedTemp} °C.`,
    };
  } else {
    bonnetAdvisor = {
      recommendedBonnetStyle: 'STANDARD_BONNET',
      bonnetTitle: 'Standard Bolted Bonnet',
      estimatedPackingBoxTemp_degC: Number((22 + 0.78 * (T_max - 22)).toFixed(0)),
      recommendedPackingSystem:
        'Live-Loaded Spring-Energized PTFE V-Ring (Low-Emissions ISO 15848-1)',
      bonnetRationale: `Process temperature (${T_min} °C to ${T_max} °C) is within the -29 °C to +232 °C envelope for a standard bonnet with low-friction PTFE packing.`,
    };
  }

  return {
    timeSeries,
    tauPlug_s,
    tauCage_s,
    tauBody_s,
    steadyStateRadialClearance_mm: Number(steadyStateRadialClearance_mm.toFixed(3)),
    minTransientRadialClearance_mm: Number(minTransientRadialClearance_mm.toFixed(3)),
    timeOfMinClearance_s,
    minSafeRadialClearanceFloor_mm,
    maxAxialDifferentialExpansion_mm: Number(maxAxialDifferentialExpansion_mm.toFixed(3)),
    recommendedColdRadialClearance_mm,
    maxSafeRampRate_degC_per_min,
    radialBindingRisk,
    axialCrushRisk,
    gallingRisk,
    gallingRationale,
    bonnetAdvisor,
  };
}
