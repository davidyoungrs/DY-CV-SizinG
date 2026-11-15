/**
 * DY-SIZE Engineering Unit System & Conversion Utilities
 * Supports General System Mode ('METRIC' | 'ENGLISH') and granular row-level unit toggles.
 */

export type GeneralUnitSystem = 'METRIC' | 'ENGLISH';

export type FlowUnit = 'm3_h' | 'gpm' | 'Nm3_h' | 'scfh' | 'scfm' | 'kg_h' | 'lb_h';
export type PressureUnit = 'bar_a' | 'psia' | 'kPa_a' | 'bar_g' | 'psig';
export type TemperatureUnit = 'degC' | 'degF' | 'K' | 'degR';
export type DensityUnit = 'kg_m3' | 'lb_ft3' | 'sg';
export type ViscosityUnit = 'cSt' | 'SSU' | 'cP';

export interface ProcessUnitsState {
  flowRate: FlowUnit;
  P1: PressureUnit;
  P2: PressureUnit;
  T1: TemperatureUnit;
  density: DensityUnit; // for Liquid rho
  Pv: PressureUnit;     // for Liquid Pv
  viscosity: ViscosityUnit; // for Liquid nu
}

export const DEFAULT_METRIC_UNITS: ProcessUnitsState = {
  flowRate: 'm3_h',
  P1: 'bar_a',
  P2: 'bar_a',
  T1: 'degC',
  density: 'kg_m3',
  Pv: 'bar_a',
  viscosity: 'cSt',
};

export const DEFAULT_ENGLISH_UNITS: ProcessUnitsState = {
  flowRate: 'gpm',
  P1: 'psia',
  P2: 'psia',
  T1: 'degF',
  density: 'lb_ft3',
  Pv: 'psia',
  viscosity: 'cSt',
};

// Conversions to/from internal canonical Metric representations:
// - Liquid flow: canonical m3/h
// - Gas flow: canonical Nm3/h
// - Steam/mass flow: canonical kg/h
// - Pressure: canonical bar_a
// - Temperature: canonical degC
// - Density: canonical kg/m3
// - Viscosity: canonical cSt

export function fromInternalFlow(flow_internal: number, unit: FlowUnit, phase: 'LIQUID' | 'GAS' | 'STEAM' | 'TWO_PHASE'): number {
  if (phase === 'LIQUID' || phase === 'TWO_PHASE') {
    if (unit === 'gpm') return flow_internal * 4.4028675; // 1 m3/h = 4.4028675 gpm
    return flow_internal; // 'm3_h'
  } else if (phase === 'GAS') {
    if (unit === 'scfh') return flow_internal * 37.326; // 1 Nm3/h (0°C, 1.01325 bar) ≈ 37.326 SCFH (60°F, 14.696 psia)
    if (unit === 'scfm') return (flow_internal * 37.326) / 60;
    return flow_internal; // 'Nm3_h'
  } else {
    // STEAM / mass flow
    if (unit === 'lb_h') return flow_internal * 2.2046226; // 1 kg = 2.2046226 lb
    return flow_internal; // 'kg_h'
  }
}

export function toInternalFlow(displayVal: number, unit: FlowUnit, phase: 'LIQUID' | 'GAS' | 'STEAM' | 'TWO_PHASE'): number {
  if (phase === 'LIQUID' || phase === 'TWO_PHASE') {
    if (unit === 'gpm') return displayVal / 4.4028675;
    return displayVal;
  } else if (phase === 'GAS') {
    if (unit === 'scfh') return displayVal / 37.326;
    if (unit === 'scfm') return (displayVal * 60) / 37.326;
    return displayVal;
  } else {
    if (unit === 'lb_h') return displayVal / 2.2046226;
    return displayVal;
  }
}

export function fromInternalPressure(p_bar_a: number, unit: PressureUnit): number {
  switch (unit) {
    case 'psia':
      return p_bar_a * 14.50377;
    case 'kPa_a':
      return p_bar_a * 100;
    case 'bar_g':
      return p_bar_a - 1.01325;
    case 'psig':
      return p_bar_a * 14.50377 - 14.696;
    case 'bar_a':
    default:
      return p_bar_a;
  }
}

export function toInternalPressure(displayVal: number, unit: PressureUnit): number {
  switch (unit) {
    case 'psia':
      return displayVal / 14.50377;
    case 'kPa_a':
      return displayVal / 100;
    case 'bar_g':
      return displayVal + 1.01325;
    case 'psig':
      return (displayVal + 14.696) / 14.50377;
    case 'bar_a':
    default:
      return displayVal;
  }
}

export function fromInternalTemperature(t_degC: number, unit: TemperatureUnit): number {
  switch (unit) {
    case 'degF':
      return t_degC * 1.8 + 32;
    case 'K':
      return t_degC + 273.15;
    case 'degR':
      return (t_degC + 273.15) * 1.8;
    case 'degC':
    default:
      return t_degC;
  }
}

export function toInternalTemperature(displayVal: number, unit: TemperatureUnit): number {
  switch (unit) {
    case 'degF':
      return (displayVal - 32) / 1.8;
    case 'K':
      return displayVal - 273.15;
    case 'degR':
      return displayVal / 1.8 - 273.15;
    case 'degC':
    default:
      return displayVal;
  }
}

export function fromInternalDensity(rho_kg_m3: number, unit: DensityUnit): number {
  switch (unit) {
    case 'lb_ft3':
      return rho_kg_m3 * 0.06242796;
    case 'sg':
      return rho_kg_m3 / 999.0;
    case 'kg_m3':
    default:
      return rho_kg_m3;
  }
}

export function toInternalDensity(displayVal: number, unit: DensityUnit): number {
  switch (unit) {
    case 'lb_ft3':
      return displayVal / 0.06242796;
    case 'sg':
      return displayVal * 999.0;
    case 'kg_m3':
    default:
      return displayVal;
  }
}

export function fromInternalViscosity(nu_cSt: number, unit: ViscosityUnit): number {
  switch (unit) {
    case 'SSU':
      // Approximate ASTM D2161 conversion: for nu > 50 cSt, SSU ≈ 4.635 * cSt; for nu <= 50, SSU ≈ 4.635 * cSt * (1 + 0.0000195*cSt) + correction
      return nu_cSt >= 50 ? nu_cSt * 4.635 : nu_cSt * 4.635 + (nu_cSt > 0 ? 1.0 : 0);
    case 'cP':
      // Dynamic viscosity for water-like SG ≈ cSt * 1.0
      return nu_cSt;
    case 'cSt':
    default:
      return nu_cSt;
  }
}

export function toInternalViscosity(displayVal: number, unit: ViscosityUnit): number {
  switch (unit) {
    case 'SSU':
      return displayVal > 0 ? Math.max(0.01, (displayVal - (displayVal < 230 ? 1.0 : 0)) / 4.635) : displayVal;
    case 'cP':
      return displayVal;
    case 'cSt':
    default:
      return displayVal;
  }
}
