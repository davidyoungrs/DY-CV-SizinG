/**
 * Pure TypeScript IAPWS-IF97 Industrial Formulation for Water and Steam
 * Covers:
 *  - Region 1: Compressed Liquid Water (273.15 K <= T <= 623.15 K, Psat <= P <= 100 MPa)
 *  - Region 2: Superheated & Sub-critical Steam
 *  - Region 3: Supercritical / Dense Steam (T > 623.15 K, P > P_B23(T), up to 100 MPa)
 *  - Region 4: Saturation Line Psat(T) and Tsat(P)
 *  - Isenthalpic Throttling & Backward T(P, h) solver for turbine bypass & attemperation
 */

export const IF97_R = 0.461526; // kJ/(kg*K)
export const IF97_TC = 647.096; // K
export const IF97_PC = 22.064; // MPa
export const IF97_RHOC = 322.0; // kg/m3

export type SteamRegion = 'REGION_1' | 'REGION_2' | 'REGION_3' | 'TWO_PHASE';

export interface SteamState {
  region: SteamRegion;
  P_bar_a: number;
  T_degC: number;
  Tsat_degC: number;
  superheat_degC: number;
  rho_kg_m3: number;
  specificVolume_m3_kg: number;
  enthalpy_kJ_kg: number;
  entropy_kJ_kgK: number;
  cp_kJ_kgK: number;
  cv_kJ_kgK: number;
  gammaCpCv: number;
  isentropicExponent: number;
  speedOfSound_m_s: number;
  compressibilityZ: number;
  vaporQuality: number; // 1.0 for superheated/supercritical, 0..1 for wet steam, 0 for subcooled liquid
}

// ---------------------------------------------------------------------------
// Region 4: Saturation Curve
// ---------------------------------------------------------------------------
const R4_N = [
  0.11670521452767e4,
  -0.72421316703206e6,
  -0.17073846940092e2,
  0.1202082470247e5,
  -0.32325550322333e7,
  0.1491510861353e2,
  -0.48232657361591e4,
  0.40511340542057e6,
  -0.23855557567849,
  0.65017534844798e3,
];

export function saturationPressure_MPa(T_K: number): number {
  const T = Math.max(273.15, Math.min(IF97_TC, T_K));
  const theta = T + R4_N[8] / (T - R4_N[9]);
  const A = theta * theta + R4_N[0] * theta + R4_N[1];
  const B = R4_N[2] * theta * theta + R4_N[3] * theta + R4_N[4];
  const C = R4_N[5] * theta * theta + R4_N[6] * theta + R4_N[7];
  const term = (2 * C) / (-B + Math.sqrt(B * B - 4 * A * C));
  return Math.pow(term, 4);
}

export function saturationTemperature_K(P_MPa: number): number {
  if (P_MPa >= IF97_PC) return IF97_TC;
  const P = Math.max(611.657e-6, P_MPa);
  const beta = Math.pow(P, 0.25);
  const E = beta * beta + R4_N[2] * beta + R4_N[5];
  const F = R4_N[0] * beta * beta + R4_N[3] * beta + R4_N[6];
  const G = R4_N[1] * beta * beta + R4_N[4] * beta + R4_N[7];
  const D = (2 * G) / (-F - Math.sqrt(F * F - 4 * E * G));
  return (R4_N[9] + D - Math.sqrt(Math.pow(R4_N[9] + D, 2) - 4 * (R4_N[8] + R4_N[9] * D))) / 2;
}

// Boundary between Region 2 and Region 3: P_B23(T)
const B23_N = [
  0.34805185628969e3,
  -0.11671859879975e1,
  0.10192970039326e-2,
  0.57254459862746e3,
  0.1391883977887e2,
];

function boundary23Pressure_MPa(T_K: number): number {
  return B23_N[0] + B23_N[1] * T_K + B23_N[2] * T_K * T_K;
}

// ---------------------------------------------------------------------------
// Region 1: Compressed Liquid Water
// ---------------------------------------------------------------------------
const R1_I = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 4, 4, 4, 5, 8, 8, 21, 23, 29, 30, 31, 32,
];
const R1_J = [
  -2, -1, 0, 1, 2, 3, 4, 5, -9, -7, -1, 0, 1, 3, -3, 0, 1, 3, 17, -4, 0, 6, -5, -2, 10, -8, -11, -6, -29, -31, -38, -39, -40, -41,
];
const R1_N = [
  0.14632971213167, -0.84548187169114, -0.3756360367204e1, 0.33855169168385e1, -0.95791963387872,
  0.15772038513228, -0.16616417199501e-1, 0.81214629983568e-3, 0.28319080123804e-3, -0.60706301565874e-3,
  -0.18990068218419e-1, -0.32529748770505e-1, -0.21841717175414e-1, -0.5283835796993e-4, -0.47184321073267e-3,
  -0.30001780793026e-3, 0.47661393906987e-4, -0.44141845330846e-5, -0.72694996297594e-15, -0.31679644845054e-4,
  -0.28270797985312e-5, -0.85205128120103e-9, -0.22425281908e-5, -0.65171222895601e-6, -0.14341729937924e-12,
  -0.40516996860117e-6, -0.12734301741641e-8, -0.17424871230634e-9, -0.68762131295531e-18, 0.14478307828521e-19,
  0.26335781662795e-22, -0.11947622640071e-22, 0.18228094581404e-23, -0.93537087292458e-25,
];

function evalRegion1(P_MPa: number, T_K: number) {
  const pi = P_MPa / 16.53;
  const tau = 1386 / T_K;
  let g = 0, g_pi = 0, g_pipi = 0, g_tau = 0, g_tautau = 0, g_pitau = 0;
  for (let k = 0; k < 34; k++) {
    const I = R1_I[k];
    const J = R1_J[k];
    const n = R1_N[k];
    const a = Math.pow(7.1 - pi, I);
    const b = Math.pow(tau - 1.222, J);
    g += n * a * b;
    if (I !== 0) {
      const a1 = Math.pow(7.1 - pi, I - 1);
      g_pi += -n * I * a1 * b;
      if (I > 1) {
        g_pipi += n * I * (I - 1) * Math.pow(7.1 - pi, I - 2) * b;
      }
      if (J !== 0) {
        g_pitau += -n * I * a1 * J * Math.pow(tau - 1.222, J - 1);
      }
    }
    if (J !== 0) {
      const b1 = Math.pow(tau - 1.222, J - 1);
      g_tau += n * a * J * b1;
      g_tautau += n * a * J * (J - 1) * Math.pow(tau - 1.222, J - 2);
    }
  }
  const v = ((IF97_R * T_K) / (P_MPa * 1000)) * pi * g_pi; // m3/kg
  const h = IF97_R * T_K * tau * g_tau; // kJ/kg
  const s = IF97_R * (tau * g_tau - g); // kJ/(kg*K)
  const cp = -IF97_R * tau * tau * g_tautau;
  const cv = IF97_R * (-tau * tau * g_tautau + Math.pow(g_pi - tau * g_pitau, 2) / g_pipi);
  const w2 = (IF97_R * 1000 * T_K * pi * pi * g_pi * g_pi) / (Math.pow(g_pi - tau * g_pitau, 2) / (tau * tau * g_tautau) - g_pipi);
  const w = Math.sqrt(Math.max(100, w2));
  return { v, h, s, cp, cv, w };
}

// ---------------------------------------------------------------------------
// Region 2: Superheated Steam
// ---------------------------------------------------------------------------
const R2_J0 = [0, 1, -5, -4, -3, -2, -1, 2, 3];
const R2_N0 = [
  -0.96927686500217e1, 0.10086655968018e2, -0.5608791128302e-2, 0.71452738081455e-1,
  -0.40710498223928, 0.14240819171444e1, -0.4383951131945e1, -0.28408632460772, 0.21268463753307e-1,
];

const R2_I = [
  1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 5, 6, 6, 6, 7, 7, 7, 8, 8, 9, 10, 10, 10, 16, 16, 18, 20, 20, 20, 21, 22, 23, 24, 24, 24,
];
const R2_J = [
  0, 1, 2, 3, 6, 1, 2, 4, 7, 36, 0, 1, 3, 6, 35, 1, 2, 3, 7, 3, 16, 35, 0, 11, 25, 8, 36, 13, 4, 10, 14, 29, 50, 57, 20, 35, 48, 21, 53, 39, 26, 40, 58,
];
const R2_N = [
  -0.17731742473213e-2, -0.17834862292358e-1, -0.45996013696365e-1, -0.57581259083432e-1, -0.5032527872793e-1,
  -0.33032641670203e-4, -0.18948987516315e-3, -0.39392777243355e-2, -0.43797295650573e-1, -0.26674547914087e-4,
  0.20481737692309e-7, 0.43870667284435e-6, -0.3227767723857e-4, -0.15033924542148e-2, -0.40668253562649e-1,
  -0.78847309559367e-9, 0.12790717852285e-7, 0.48225372718507e-6, 0.22922076337661e-5, -0.16714766451061e-10,
  -0.21171472321355e-2, -0.23895741934104e2, -0.5905956432427e-17, -0.12621808899101e-5, -0.38946842435739e-1,
  0.11256211360459e-10, -0.82311340897998e1, 0.19809712802088e-7, 0.10406965210174e-18, -0.10234747095929e-12,
  -0.10018179379511e-8, -0.80882908646985e-10, 0.10693031879409, -0.33662250574171, 0.89185845355421e-24,
  0.30629316876232e-12, -0.42002467698208e-5, -0.59056029685639e-25, 0.37826947613457e-5, -0.12768608934681e-14,
  0.73087610595061e-28, 0.55414715350778e-16, -0.9436970724121e-6,
];

function evalRegion2(P_MPa: number, T_K: number) {
  const pi = P_MPa; // P* = 1 MPa
  const tau = 540 / T_K;

  let g0 = Math.log(pi);
  let g0_tau = 0;
  let g0_tautau = 0;
  for (let k = 0; k < 9; k++) {
    const J = R2_J0[k];
    const n = R2_N0[k];
    g0 += n * Math.pow(tau, J);
    if (J !== 0) {
      g0_tau += n * J * Math.pow(tau, J - 1);
      g0_tautau += n * J * (J - 1) * Math.pow(tau, J - 2);
    }
  }
  const g0_pi = 1 / pi;

  let gr = 0, gr_pi = 0, gr_pipi = 0, gr_tau = 0, gr_tautau = 0, gr_pitau = 0;
  for (let k = 0; k < 43; k++) {
    const I = R2_I[k];
    const J = R2_J[k];
    const n = R2_N[k];
    const a = Math.pow(pi, I);
    const b = Math.pow(tau - 0.5, J);
    gr += n * a * b;
    gr_pi += n * I * Math.pow(pi, I - 1) * b;
    if (I > 1) {
      gr_pipi += n * I * (I - 1) * Math.pow(pi, I - 2) * b;
    }
    if (J !== 0) {
      const b1 = Math.pow(tau - 0.5, J - 1);
      gr_tau += n * a * J * b1;
      gr_tautau += n * a * J * (J - 1) * Math.pow(tau - 0.5, J - 2);
      gr_pitau += n * I * Math.pow(pi, I - 1) * J * b1;
    }
  }

  const v = ((IF97_R * T_K) / (P_MPa * 1000)) * pi * (g0_pi + gr_pi);
  const h = IF97_R * T_K * tau * (g0_tau + gr_tau);
  const s = IF97_R * (tau * (g0_tau + gr_tau) - (g0 + gr));
  const cp = -IF97_R * tau * tau * (g0_tautau + gr_tautau);
  const cv =
    IF97_R *
    (-tau * tau * (g0_tautau + gr_tautau) -
      Math.pow(1 + pi * gr_pi - tau * pi * gr_pitau, 2) / (1 - pi * pi * gr_pipi));
  const w2 =
    (IF97_R * 1000 * T_K * (1 + 2 * pi * gr_pi + pi * pi * gr_pi * gr_pi)) /
    (1 -
      pi * pi * gr_pipi +
      Math.pow(1 + pi * gr_pi - tau * pi * gr_pitau, 2) / (tau * tau * (g0_tautau + gr_tautau)));
  const w = Math.sqrt(Math.max(50, w2));
  return { v, h, s, cp, cv, w };
}

// ---------------------------------------------------------------------------
// Region 3: Supercritical / Dense Steam (Helmholtz phi(delta, tau))
// ---------------------------------------------------------------------------
const R3_I = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 6, 6, 6, 7, 8, 9, 9, 10, 10, 11,
];
const R3_J = [
  0, 0, 1, 2, 7, 10, 12, 23, 2, 6, 15, 17, 0, 2, 6, 7, 22, 26, 0, 2, 4, 16, 26, 0, 2, 4, 26, 1, 3, 26, 0, 2, 26, 2, 26, 2, 26, 0, 1, 26,
];
const R3_N = [
  0.10658070028513e1, -0.15732845290239e2, 0.20944396974307e2, -0.76867707878716e1, 0.26185947787954e1,
  -0.2808078114862e1, 0.12053369696517e1, -0.84566812812502e-2, -0.12654315477714e1, -0.11524407806681e1,
  0.88521043984318, -0.64207765181607, 0.38493460186671, -0.85214708824206, 0.48972281541877e1,
  -0.30502617256965e1, 0.39420536879154e-1, 0.12558408424308, -0.2799932969871, 0.1389979956946e1,
  -0.2018991502357e1, -0.82147637173963e-2, -0.47596035734923, 0.439840744735e-1, -0.44476435428739,
  0.90572070719733, 0.70522450087967, 0.10770512626332, -0.32913623258954, -0.50871062041158,
  -0.22175400873096e-1, 0.94260751665092e-1, 0.16436278447961, -0.13503372241348e-1, -0.14834345352472e-1,
  0.57922953628084e-3, 0.32308904703711e-2, 0.80964802996215e-4, -0.16557679795037e-3, -0.44923899061815e-4,
];

function evalRegion3RhoT(rho: number, T_K: number) {
  const delta = rho / IF97_RHOC;
  const tau = IF97_TC / T_K;

  let phi = R3_N[0] * Math.log(delta);
  let phi_delta = R3_N[0] / delta;
  let phi_deltadelta = -R3_N[0] / (delta * delta);
  let phi_tau = 0;
  let phi_tautau = 0;
  let phi_deltatau = 0;

  for (let k = 1; k < 40; k++) {
    const I = R3_I[k];
    const J = R3_J[k];
    const n = R3_N[k];
    const dI = Math.pow(delta, I);
    const tJ = Math.pow(tau, J);
    phi += n * dI * tJ;
    if (I !== 0) {
      const dI1 = Math.pow(delta, I - 1);
      phi_delta += n * I * dI1 * tJ;
      phi_deltadelta += n * I * (I - 1) * Math.pow(delta, I - 2) * tJ;
      if (J !== 0) {
        phi_deltatau += n * I * dI1 * J * Math.pow(tau, J - 1);
      }
    }
    if (J !== 0) {
      const tJ1 = Math.pow(tau, J - 1);
      phi_tau += n * dI * J * tJ1;
      phi_tautau += n * dI * J * (J - 1) * Math.pow(tau, J - 2);
    }
  }

  const P_MPa = (rho * IF97_R * T_K * delta * phi_delta) / 1000;
  const dP_drho = ((IF97_R * T_K) / 1000) * (2 * delta * phi_delta + delta * delta * phi_deltadelta);
  const h = IF97_R * T_K * (tau * phi_tau + delta * phi_delta);
  const s = IF97_R * (tau * phi_tau - phi);
  const cv = -IF97_R * tau * tau * phi_tautau;
  const cp =
    IF97_R *
    (-tau * tau * phi_tautau +
      Math.pow(delta * phi_delta - delta * tau * phi_deltatau, 2) /
        Math.max(1e-6, 2 * delta * phi_delta + delta * delta * phi_deltadelta));
  const w2 =
    IF97_R *
    1000 *
    T_K *
    (2 * delta * phi_delta +
      delta * delta * phi_deltadelta -
      Math.pow(delta * phi_delta - delta * tau * phi_deltatau, 2) / (tau * tau * phi_tautau));
  const w = Math.sqrt(Math.max(50, w2));

  return { P_MPa, dP_drho, v: 1 / rho, h, s, cp, cv, w };
}

function evalRegion3(P_MPa: number, T_K: number) {
  // Solve rho(P, T) via bounded Newton-Raphson + bisection fallback
  let rhoLow = 50;
  let rhoHigh = 850;
  let rho = P_MPa > IF97_PC ? 350 : 180;
  for (let iter = 0; iter < 30; iter++) {
    const st = evalRegion3RhoT(rho, T_K);
    const err = st.P_MPa - P_MPa;
    if (Math.abs(err) < 1e-6 * P_MPa) {
      return st;
    }
    if (err < 0) rhoLow = Math.max(rhoLow, rho);
    else rhoHigh = Math.min(rhoHigh, rho);

    const next = st.dP_drho > 1e-6 ? rho - err / st.dP_drho : 0.5 * (rhoLow + rhoHigh);
    if (next <= rhoLow || next >= rhoHigh || !Number.isFinite(next)) {
      rho = 0.5 * (rhoLow + rhoHigh);
    } else {
      rho = next;
    }
  }
  return evalRegion3RhoT(rho, T_K);
}

// ---------------------------------------------------------------------------
// Unified Public API
// ---------------------------------------------------------------------------
export function evaluateSteamPT(P_bar_a: number, T_degC: number): SteamState {
  const P_MPa = Math.max(0.001, Math.min(100, P_bar_a / 10));
  const T_K = Math.max(273.15, Math.min(1073.15, T_degC + 273.15));
  const Tsat_K = P_MPa < IF97_PC ? saturationTemperature_K(P_MPa) : IF97_TC;
  const Tsat_degC = Tsat_K - 273.15;

  let region: SteamRegion = 'REGION_2';
  let props: { v: number; h: number; s: number; cp: number; cv: number; w: number };

  if (T_K <= 623.15) {
    const Psat = saturationPressure_MPa(T_K);
    if (P_MPa > Psat * 1.0001) {
      region = 'REGION_1';
      props = evalRegion1(P_MPa, T_K);
    } else {
      region = 'REGION_2';
      props = evalRegion2(P_MPa, T_K);
    }
  } else if (T_K <= 863.15 && P_MPa > boundary23Pressure_MPa(T_K)) {
    region = 'REGION_3';
    props = evalRegion3(P_MPa, T_K);
  } else {
    region = 'REGION_2';
    props = evalRegion2(P_MPa, T_K);
  }

  const rho_kg_m3 = 1 / Math.max(1e-6, props.v);
  const P_kPa = P_MPa * 1000;
  const compressibilityZ = Math.max(0.15, Math.min(1.25, (P_kPa * props.v) / (IF97_R * T_K)));
  const gammaCpCv = Math.max(1.05, Math.min(1.5, props.cp / Math.max(0.1, props.cv)));
  const isentropicExponent = Math.max(
    1.05,
    Math.min(1.5, (props.w * props.w) / Math.max(100, P_MPa * 1e6 * props.v))
  );

  return {
    region,
    P_bar_a,
    T_degC: Number((T_K - 273.15).toFixed(2)),
    Tsat_degC: Number(Tsat_degC.toFixed(2)),
    superheat_degC: Number(Math.max(0, T_K - 273.15 - Tsat_degC).toFixed(2)),
    rho_kg_m3,
    specificVolume_m3_kg: props.v,
    enthalpy_kJ_kg: props.h,
    entropy_kJ_kgK: props.s,
    cp_kJ_kgK: props.cp,
    cv_kJ_kgK: props.cv,
    gammaCpCv: Number(gammaCpCv.toFixed(3)),
    isentropicExponent: Number(isentropicExponent.toFixed(3)),
    speedOfSound_m_s: props.w,
    compressibilityZ: Number(compressibilityZ.toFixed(4)),
    vaporQuality: region === 'REGION_1' ? 0 : 1,
  };
}

/**
 * Solves steam state at (P_bar_a, enthalpy_kJ_kg) — used for:
 *  1. Isenthalpic throttling across a control valve (h2 = h1)
 *  2. Post-attemperation mixed state after spray-water injection
 */
export function evaluateSteamPH(P_bar_a: number, enthalpy_kJ_kg: number): SteamState {
  const P_MPa = Math.max(0.001, Math.min(100, P_bar_a / 10));

  // Check saturation dome if subcritical
  if (P_MPa < IF97_PC) {
    const Tsat_K = saturationTemperature_K(P_MPa);
    const satLiq = Tsat_K <= 623.15 ? evalRegion1(P_MPa, Tsat_K) : evalRegion3(P_MPa * 1.0001, Tsat_K);
    const satVap = Tsat_K <= 623.15 ? evalRegion2(P_MPa, Tsat_K) : evalRegion3(P_MPa * 0.9999, Tsat_K);

    if (enthalpy_kJ_kg >= satLiq.h && enthalpy_kJ_kg <= satVap.h) {
      const quality = Math.max(0, Math.min(1, (enthalpy_kJ_kg - satLiq.h) / Math.max(1e-3, satVap.h - satLiq.h)));
      const v_mix = satLiq.v + quality * (satVap.v - satLiq.v);
      const s_mix = satLiq.s + quality * (satVap.s - satLiq.s);
      const rho_mix = 1 / Math.max(1e-6, v_mix);
      const Tsat_degC = Tsat_K - 273.15;
      return {
        region: 'TWO_PHASE',
        P_bar_a,
        T_degC: Number(Tsat_degC.toFixed(2)),
        Tsat_degC: Number(Tsat_degC.toFixed(2)),
        superheat_degC: 0,
        rho_kg_m3: rho_mix,
        specificVolume_m3_kg: v_mix,
        enthalpy_kJ_kg,
        entropy_kJ_kgK: s_mix,
        cp_kJ_kgK: satVap.cp,
        cv_kJ_kgK: satVap.cv,
        gammaCpCv: 1.135,
        isentropicExponent: 1.135,
        speedOfSound_m_s: satVap.w * (0.65 + 0.35 * quality),
        compressibilityZ: Number(((P_MPa * 1000 * v_mix) / (IF97_R * Tsat_K)).toFixed(4)),
        vaporQuality: Number(quality.toFixed(4)),
      };
    }
  }

  // Monotonic T(P, h) bisection from 0.1 °C to 800 °C
  let tLow = 0.1;
  let tHigh = 800;
  for (let i = 0; i < 36; i++) {
    const tMid = 0.5 * (tLow + tHigh);
    const st = evaluateSteamPT(P_bar_a, tMid);
    if (Math.abs(st.enthalpy_kJ_kg - enthalpy_kJ_kg) < 0.05) {
      return st;
    }
    if (st.enthalpy_kJ_kg < enthalpy_kJ_kg) tLow = tMid;
    else tHigh = tMid;
  }
  return evaluateSteamPT(P_bar_a, 0.5 * (tLow + tHigh));
}
