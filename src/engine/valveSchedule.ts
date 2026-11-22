export type PressureClassId =
  | 'CL150_PN16'
  | 'CL300_PN40'
  | 'CL600_PN100'
  | 'CL900_PN160'
  | 'CL1500_PN250'
  | 'CL2500_PN420';

export type TrimStyleId =
  | 'CONTOURED_LINEAR'
  | 'CONTOURED_EQP'
  | 'WINDOW_CAGE'
  | 'CAGE_1STAGE'
  | 'CAGE_2STAGE'
  | 'CAGE_3STAGE';

export type BodyStyleId = 'GLOBE_STRAIGHT' | 'ANGLE_BODY';

export type FlowDirectionId = 'FTO' | 'FTC';

export interface PressureClassSpec {
  id: PressureClassId;
  label: string;
  pnEquivalent: string;
  asmeClass: number;
  maxPressureBarAt20C: number;
  capacityMultiplierKClass: number; // K_class
  cageWallFactor: number;
}

export const PRESSURE_CLASSES: Record<PressureClassId, PressureClassSpec> = {
  CL150_PN16: {
    id: 'CL150_PN16',
    label: 'ASME Class 150 / PN16–20',
    pnEquivalent: 'PN16 / PN20',
    asmeClass: 150,
    maxPressureBarAt20C: 19.6,
    capacityMultiplierKClass: 1.0,
    cageWallFactor: 1.0,
  },
  CL300_PN40: {
    id: 'CL300_PN40',
    label: 'ASME Class 300 / PN40–50',
    pnEquivalent: 'PN40 / PN50',
    asmeClass: 300,
    maxPressureBarAt20C: 51.1,
    capacityMultiplierKClass: 1.0,
    cageWallFactor: 1.05,
  },
  CL600_PN100: {
    id: 'CL600_PN100',
    label: 'ASME Class 600 / PN100',
    pnEquivalent: 'PN100',
    asmeClass: 600,
    maxPressureBarAt20C: 102.1,
    capacityMultiplierKClass: 1.0,
    cageWallFactor: 1.15,
  },
  CL900_PN160: {
    id: 'CL900_PN160',
    label: 'ASME Class 900 / PN160',
    pnEquivalent: 'PN160',
    asmeClass: 900,
    maxPressureBarAt20C: 153.2,
    capacityMultiplierKClass: 0.90,
    cageWallFactor: 1.30,
  },
  CL1500_PN250: {
    id: 'CL1500_PN250',
    label: 'ASME Class 1500 / PN250',
    pnEquivalent: 'PN250',
    asmeClass: 1500,
    maxPressureBarAt20C: 255.3,
    capacityMultiplierKClass: 0.78,
    cageWallFactor: 1.55,
  },
  CL2500_PN420: {
    id: 'CL2500_PN420',
    label: 'ASME Class 2500 / PN420',
    pnEquivalent: 'PN420',
    asmeClass: 2500,
    maxPressureBarAt20C: 425.5,
    capacityMultiplierKClass: 0.62,
    cageWallFactor: 1.90,
  },
};

export interface TrimStyleSpec {
  id: TrimStyleId;
  name: string;
  shortName: string;
  stages: number;
  cdSpecificCapacity: number; // Cd = Cv / d_in^2
  FL_FTO: number;
  FL_FTC: number;
  Kc_FTO: number;
  Kc_FTC: number;
  xT_FTO: number;
  xT_FTC: number;
  Fd_default: number;
  openAreaRatioEta: number; // eta_open for curtain area calculation
  orificeDischargeCoeff: number; // C_discharge
  description: string;
}

export const TRIM_STYLES: Record<TrimStyleId, TrimStyleSpec> = {
  CONTOURED_LINEAR: {
    id: 'CONTOURED_LINEAR',
    name: 'Contoured Plug (Single-Seat Linear)',
    shortName: 'Contoured Linear',
    stages: 1,
    cdSpecificCapacity: 16.0,
    FL_FTO: 0.89,
    FL_FTC: 0.82,
    Kc_FTO: 0.78,
    Kc_FTC: 0.68,
    xT_FTO: 0.72,
    xT_FTC: 0.65,
    Fd_default: 0.46,
    openAreaRatioEta: 0.70,
    orificeDischargeCoeff: 0.76,
    description: 'High-capacity single-seated parabolic contoured plug for clean service.',
  },
  CONTOURED_EQP: {
    id: 'CONTOURED_EQP',
    name: 'Contoured Plug (Single-Seat Equal-%)',
    shortName: 'Contoured Equal-%',
    stages: 1,
    cdSpecificCapacity: 14.0,
    FL_FTO: 0.90,
    FL_FTC: 0.84,
    Kc_FTO: 0.80,
    Kc_FTC: 0.70,
    xT_FTO: 0.74,
    xT_FTC: 0.67,
    Fd_default: 0.46,
    openAreaRatioEta: 0.65,
    orificeDischargeCoeff: 0.74,
    description: 'Standard equal-percentage contoured plug for wide rangeability process loops.',
  },
  WINDOW_CAGE: {
    id: 'WINDOW_CAGE',
    name: 'Standard Ported / Window Cage Trim',
    shortName: 'Window Cage',
    stages: 1,
    cdSpecificCapacity: 15.0,
    FL_FTO: 0.88,
    FL_FTC: 0.86,
    Kc_FTO: 0.75,
    Kc_FTC: 0.73,
    xT_FTO: 0.70,
    xT_FTC: 0.68,
    Fd_default: 0.35,
    openAreaRatioEta: 0.60,
    orificeDischargeCoeff: 0.72,
    description: 'Heavy cage-guided window trim with 3–6 profiled ports.',
  },
  CAGE_1STAGE: {
    id: 'CAGE_1STAGE',
    name: '1-Stage Characterized Drilled-Hole Cage',
    shortName: '1-Stage Drilled Cage',
    stages: 1,
    cdSpecificCapacity: 11.5,
    FL_FTO: 0.91,
    FL_FTC: 0.93,
    Kc_FTO: 0.83,
    Kc_FTC: 0.86,
    xT_FTO: 0.76,
    xT_FTC: 0.78,
    Fd_default: 0.10,
    openAreaRatioEta: 0.40,
    orificeDischargeCoeff: 0.68,
    description: 'Multi-hole radial drilled sleeve for acoustic frequency shifting (FTO) and anti-cavitation central jet impingement (FTC).',
  },
  CAGE_2STAGE: {
    id: 'CAGE_2STAGE',
    name: '2-Stage Concentric Drilled-Hole Cage',
    shortName: '2-Stage Drilled Cage',
    stages: 2,
    cdSpecificCapacity: 8.0,
    FL_FTO: 0.95,
    FL_FTC: 0.96,
    Kc_FTO: 0.91,
    Kc_FTC: 0.93,
    xT_FTO: 0.83,
    xT_FTC: 0.85,
    Fd_default: 0.07,
    openAreaRatioEta: 0.32,
    orificeDischargeCoeff: 0.64,
    description: 'Double concentric drilled sleeves splitting pressure drop across two radial expansion stages.',
  },
  CAGE_3STAGE: {
    id: 'CAGE_3STAGE',
    name: '3-Stage Drilled Cage / Multi-Path Tortuous Trim',
    shortName: '3-Stage / Tortuous',
    stages: 3,
    cdSpecificCapacity: 5.0,
    FL_FTO: 0.98,
    FL_FTC: 0.98,
    Kc_FTO: 0.96,
    Kc_FTC: 0.97,
    xT_FTO: 0.89,
    xT_FTC: 0.91,
    Fd_default: 0.04,
    openAreaRatioEta: 0.24,
    orificeDischargeCoeff: 0.60,
    description: 'Severe-service 3-stage concentric cage or multi-turn labyrinth disk stack for extreme pressure letdown.',
  },
};

export interface GenericValveSizeSpec {
  dn: number;
  npsLabel: string;
  d_in: number;
  d_mm: number;
  d_port_mm: number; // 100% Full Seat Bore (mm)
  d_port_in: number; // 100% Full Seat Bore (in)
  strokeStd_mm: number; // Standard Travel H_std (mm)
  strokeStd_in: number;
  strokeExt_mm: number; // Extended Travel H_ext (mm) for large multi-stage cages
  strokeExt_in: number;
  stemDiaStd_mm: number;
  stemDiaHeavy_mm: number;
  cageWallStd_mm: number; // Baseline 1-stage cage radial wall thickness (mm)
  bodyMinWall_mm: Record<PressureClassId, number>; // ASME B16.34 / API 600 min wall
  faceToFaceCL300_mm: number; // ISA-75.08.01 Class 300 face-to-face
  ratedCvBaseline: Record<TrimStyleId, number>; // Class 150-600 Straight Globe 100% Port Rated Cv
}

export const GENERIC_VALVE_SCHEDULE: GenericValveSizeSpec[] = [
  {
    dn: 15,
    npsLabel: '1/2"',
    d_in: 0.5,
    d_mm: 15,
    d_port_mm: 15.0,
    d_port_in: 0.59,
    strokeStd_mm: 19,
    strokeStd_in: 0.75,
    strokeExt_mm: 25,
    strokeExt_in: 1.0,
    stemDiaStd_mm: 10,
    stemDiaHeavy_mm: 12,
    cageWallStd_mm: 5.5,
    bodyMinWall_mm: {
      CL150_PN16: 5.0,
      CL300_PN40: 6.0,
      CL600_PN100: 7.0,
      CL900_PN160: 8.5,
      CL1500_PN250: 10.5,
      CL2500_PN420: 14.0,
    },
    faceToFaceCL300_mm: 190,
    ratedCvBaseline: {
      CONTOURED_LINEAR: 5.5,
      CONTOURED_EQP: 4.8,
      WINDOW_CAGE: 5.2,
      CAGE_1STAGE: 4.0,
      CAGE_2STAGE: 2.8,
      CAGE_3STAGE: 1.8,
    },
  },
  {
    dn: 20,
    npsLabel: '3/4"',
    d_in: 0.75,
    d_mm: 20,
    d_port_mm: 20.0,
    d_port_in: 0.79,
    strokeStd_mm: 19,
    strokeStd_in: 0.75,
    strokeExt_mm: 25,
    strokeExt_in: 1.0,
    stemDiaStd_mm: 10,
    stemDiaHeavy_mm: 12,
    cageWallStd_mm: 6.0,
    bodyMinWall_mm: {
      CL150_PN16: 5.5,
      CL300_PN40: 6.5,
      CL600_PN100: 7.5,
      CL900_PN160: 9.0,
      CL1500_PN250: 11.5,
      CL2500_PN420: 15.5,
    },
    faceToFaceCL300_mm: 194,
    ratedCvBaseline: {
      CONTOURED_LINEAR: 9.5,
      CONTOURED_EQP: 8.2,
      WINDOW_CAGE: 8.8,
      CAGE_1STAGE: 6.8,
      CAGE_2STAGE: 4.6,
      CAGE_3STAGE: 3.0,
    },
  },
  {
    dn: 25,
    npsLabel: '1"',
    d_in: 1.0,
    d_mm: 25,
    d_port_mm: 25.4,
    d_port_in: 1.0,
    strokeStd_mm: 19,
    strokeStd_in: 0.75,
    strokeExt_mm: 29,
    strokeExt_in: 1.125,
    stemDiaStd_mm: 12,
    stemDiaHeavy_mm: 16,
    cageWallStd_mm: 6.5,
    bodyMinWall_mm: {
      CL150_PN16: 6.5,
      CL300_PN40: 7.0,
      CL600_PN100: 8.5,
      CL900_PN160: 10.5,
      CL1500_PN250: 13.0,
      CL2500_PN420: 17.5,
    },
    faceToFaceCL300_mm: 197,
    ratedCvBaseline: {
      CONTOURED_LINEAR: 16.0,
      CONTOURED_EQP: 14.0,
      WINDOW_CAGE: 15.0,
      CAGE_1STAGE: 11.5,
      CAGE_2STAGE: 8.0,
      CAGE_3STAGE: 5.0,
    },
  },
  {
    dn: 40,
    npsLabel: '1-1/2"',
    d_in: 1.5,
    d_mm: 40,
    d_port_mm: 38.1,
    d_port_in: 1.5,
    strokeStd_mm: 25,
    strokeStd_in: 1.0,
    strokeExt_mm: 38,
    strokeExt_in: 1.5,
    stemDiaStd_mm: 12,
    stemDiaHeavy_mm: 16,
    cageWallStd_mm: 7.5,
    bodyMinWall_mm: {
      CL150_PN16: 7.5,
      CL300_PN40: 9.0,
      CL600_PN100: 10.5,
      CL900_PN160: 13.0,
      CL1500_PN250: 16.5,
      CL2500_PN420: 22.0,
    },
    faceToFaceCL300_mm: 235,
    ratedCvBaseline: {
      CONTOURED_LINEAR: 36.0,
      CONTOURED_EQP: 31.5,
      WINDOW_CAGE: 33.8,
      CAGE_1STAGE: 26.0,
      CAGE_2STAGE: 18.0,
      CAGE_3STAGE: 11.5,
    },
  },
  {
    dn: 50,
    npsLabel: '2"',
    d_in: 2.0,
    d_mm: 50,
    d_port_mm: 50.8,
    d_port_in: 2.0,
    strokeStd_mm: 29,
    strokeStd_in: 1.125,
    strokeExt_mm: 50,
    strokeExt_in: 2.0,
    stemDiaStd_mm: 16,
    stemDiaHeavy_mm: 20,
    cageWallStd_mm: 8.5,
    bodyMinWall_mm: {
      CL150_PN16: 8.5,
      CL300_PN40: 9.5,
      CL600_PN100: 11.5,
      CL900_PN160: 14.5,
      CL1500_PN250: 19.0,
      CL2500_PN420: 26.0,
    },
    faceToFaceCL300_mm: 267,
    ratedCvBaseline: {
      CONTOURED_LINEAR: 64.0,
      CONTOURED_EQP: 56.0,
      WINDOW_CAGE: 60.0,
      CAGE_1STAGE: 46.0,
      CAGE_2STAGE: 32.0,
      CAGE_3STAGE: 20.0,
    },
  },
  {
    dn: 65,
    npsLabel: '2-1/2"',
    d_in: 2.5,
    d_mm: 65,
    d_port_mm: 63.5,
    d_port_in: 2.5,
    strokeStd_mm: 38,
    strokeStd_in: 1.5,
    strokeExt_mm: 50,
    strokeExt_in: 2.0,
    stemDiaStd_mm: 16,
    stemDiaHeavy_mm: 20,
    cageWallStd_mm: 9.5,
    bodyMinWall_mm: {
      CL150_PN16: 9.5,
      CL300_PN40: 11.0,
      CL600_PN100: 13.0,
      CL900_PN160: 16.5,
      CL1500_PN250: 22.0,
      CL2500_PN420: 30.0,
    },
    faceToFaceCL300_mm: 292,
    ratedCvBaseline: {
      CONTOURED_LINEAR: 100.0,
      CONTOURED_EQP: 88.0,
      WINDOW_CAGE: 94.0,
      CAGE_1STAGE: 72.0,
      CAGE_2STAGE: 50.0,
      CAGE_3STAGE: 31.0,
    },
  },
  {
    dn: 80,
    npsLabel: '3"',
    d_in: 3.0,
    d_mm: 80,
    d_port_mm: 76.2,
    d_port_in: 3.0,
    strokeStd_mm: 38,
    strokeStd_in: 1.5,
    strokeExt_mm: 60,
    strokeExt_in: 2.36,
    stemDiaStd_mm: 20,
    stemDiaHeavy_mm: 25,
    cageWallStd_mm: 10.5,
    bodyMinWall_mm: {
      CL150_PN16: 10.5,
      CL300_PN40: 12.5,
      CL600_PN100: 15.0,
      CL900_PN160: 19.0,
      CL1500_PN250: 25.0,
      CL2500_PN420: 34.0,
    },
    faceToFaceCL300_mm: 318,
    ratedCvBaseline: {
      CONTOURED_LINEAR: 144.0,
      CONTOURED_EQP: 126.0,
      WINDOW_CAGE: 135.0,
      CAGE_1STAGE: 104.0,
      CAGE_2STAGE: 72.0,
      CAGE_3STAGE: 45.0,
    },
  },
  {
    dn: 100,
    npsLabel: '4"',
    d_in: 4.0,
    d_mm: 100,
    d_port_mm: 101.6,
    d_port_in: 4.0,
    strokeStd_mm: 50,
    strokeStd_in: 2.0,
    strokeExt_mm: 75,
    strokeExt_in: 3.0,
    stemDiaStd_mm: 20,
    stemDiaHeavy_mm: 25,
    cageWallStd_mm: 12.0,
    bodyMinWall_mm: {
      CL150_PN16: 12.0,
      CL300_PN40: 14.5,
      CL600_PN100: 18.0,
      CL900_PN160: 23.0,
      CL1500_PN250: 30.0,
      CL2500_PN420: 41.0,
    },
    faceToFaceCL300_mm: 368,
    ratedCvBaseline: {
      CONTOURED_LINEAR: 256.0,
      CONTOURED_EQP: 224.0,
      WINDOW_CAGE: 240.0,
      CAGE_1STAGE: 184.0,
      CAGE_2STAGE: 128.0,
      CAGE_3STAGE: 80.0,
    },
  },
  {
    dn: 150,
    npsLabel: '6"',
    d_in: 6.0,
    d_mm: 150,
    d_port_mm: 152.4,
    d_port_in: 6.0,
    strokeStd_mm: 60,
    strokeStd_in: 2.36,
    strokeExt_mm: 100,
    strokeExt_in: 4.0,
    stemDiaStd_mm: 25,
    stemDiaHeavy_mm: 32,
    cageWallStd_mm: 15.0,
    bodyMinWall_mm: {
      CL150_PN16: 14.5,
      CL300_PN40: 17.5,
      CL600_PN100: 23.0,
      CL900_PN160: 29.0,
      CL1500_PN250: 38.0,
      CL2500_PN420: 52.0,
    },
    faceToFaceCL300_mm: 473,
    ratedCvBaseline: {
      CONTOURED_LINEAR: 576.0,
      CONTOURED_EQP: 504.0,
      WINDOW_CAGE: 540.0,
      CAGE_1STAGE: 414.0,
      CAGE_2STAGE: 288.0,
      CAGE_3STAGE: 180.0,
    },
  },
  {
    dn: 200,
    npsLabel: '8"',
    d_in: 8.0,
    d_mm: 200,
    d_port_mm: 203.2,
    d_port_in: 8.0,
    strokeStd_mm: 90,
    strokeStd_in: 3.5,
    strokeExt_mm: 130,
    strokeExt_in: 5.12,
    stemDiaStd_mm: 32,
    stemDiaHeavy_mm: 40,
    cageWallStd_mm: 18.0,
    bodyMinWall_mm: {
      CL150_PN16: 17.0,
      CL300_PN40: 21.0,
      CL600_PN100: 28.0,
      CL900_PN160: 35.0,
      CL1500_PN250: 46.0,
      CL2500_PN420: 64.0,
    },
    faceToFaceCL300_mm: 568,
    ratedCvBaseline: {
      CONTOURED_LINEAR: 1024.0,
      CONTOURED_EQP: 896.0,
      WINDOW_CAGE: 960.0,
      CAGE_1STAGE: 736.0,
      CAGE_2STAGE: 512.0,
      CAGE_3STAGE: 320.0,
    },
  },
  {
    dn: 250,
    npsLabel: '10"',
    d_in: 10.0,
    d_mm: 250,
    d_port_mm: 254.0,
    d_port_in: 10.0,
    strokeStd_mm: 100,
    strokeStd_in: 4.0,
    strokeExt_mm: 160,
    strokeExt_in: 6.3,
    stemDiaStd_mm: 32,
    stemDiaHeavy_mm: 45,
    cageWallStd_mm: 22.0,
    bodyMinWall_mm: {
      CL150_PN16: 19.5,
      CL300_PN40: 24.5,
      CL600_PN100: 33.0,
      CL900_PN160: 42.0,
      CL1500_PN250: 55.0,
      CL2500_PN420: 76.0,
    },
    faceToFaceCL300_mm: 708,
    ratedCvBaseline: {
      CONTOURED_LINEAR: 1600.0,
      CONTOURED_EQP: 1400.0,
      WINDOW_CAGE: 1500.0,
      CAGE_1STAGE: 1150.0,
      CAGE_2STAGE: 800.0,
      CAGE_3STAGE: 500.0,
    },
  },
  {
    dn: 300,
    npsLabel: '12"',
    d_in: 12.0,
    d_mm: 300,
    d_port_mm: 304.8,
    d_port_in: 12.0,
    strokeStd_mm: 120,
    strokeStd_in: 4.75,
    strokeExt_mm: 200,
    strokeExt_in: 8.0,
    stemDiaStd_mm: 40,
    stemDiaHeavy_mm: 50,
    cageWallStd_mm: 25.0,
    bodyMinWall_mm: {
      CL150_PN16: 22.0,
      CL300_PN40: 28.0,
      CL600_PN100: 38.0,
      CL900_PN160: 48.0,
      CL1500_PN250: 64.0,
      CL2500_PN420: 88.0,
    },
    faceToFaceCL300_mm: 775,
    ratedCvBaseline: {
      CONTOURED_LINEAR: 2300.0,
      CONTOURED_EQP: 2015.0,
      WINDOW_CAGE: 2160.0,
      CAGE_1STAGE: 1655.0,
      CAGE_2STAGE: 1150.0,
      CAGE_3STAGE: 720.0,
    },
  },
  {
    dn: 350,
    npsLabel: '14"',
    d_in: 14.0,
    d_mm: 350,
    d_port_mm: 336.5,
    d_port_in: 13.25,
    strokeStd_mm: 150,
    strokeStd_in: 6.0,
    strokeExt_mm: 220,
    strokeExt_in: 8.66,
    stemDiaStd_mm: 45,
    stemDiaHeavy_mm: 55,
    cageWallStd_mm: 28.0,
    bodyMinWall_mm: {
      CL150_PN16: 24.0,
      CL300_PN40: 30.5,
      CL600_PN100: 42.0,
      CL900_PN160: 53.0,
      CL1500_PN250: 70.0,
      CL2500_PN420: 96.0,
    },
    faceToFaceCL300_mm: 889,
    ratedCvBaseline: {
      CONTOURED_LINEAR: 2810.0,
      CONTOURED_EQP: 2460.0,
      WINDOW_CAGE: 2630.0,
      CAGE_1STAGE: 2020.0,
      CAGE_2STAGE: 1405.0,
      CAGE_3STAGE: 880.0,
    },
  },
  {
    dn: 400,
    npsLabel: '16"',
    d_in: 16.0,
    d_mm: 400,
    d_port_mm: 387.4,
    d_port_in: 15.25,
    strokeStd_mm: 180,
    strokeStd_in: 7.0,
    strokeExt_mm: 250,
    strokeExt_in: 10.0,
    stemDiaStd_mm: 50,
    stemDiaHeavy_mm: 63,
    cageWallStd_mm: 32.0,
    bodyMinWall_mm: {
      CL150_PN16: 26.5,
      CL300_PN40: 34.0,
      CL600_PN100: 47.0,
      CL900_PN160: 60.0,
      CL1500_PN250: 79.0,
      CL2500_PN420: 108.0,
    },
    faceToFaceCL300_mm: 1057,
    ratedCvBaseline: {
      CONTOURED_LINEAR: 3720.0,
      CONTOURED_EQP: 3255.0,
      WINDOW_CAGE: 3485.0,
      CAGE_1STAGE: 2675.0,
      CAGE_2STAGE: 1860.0,
      CAGE_3STAGE: 1160.0,
    },
  },
  {
    dn: 500,
    npsLabel: '20"',
    d_in: 20.0,
    d_mm: 500,
    d_port_mm: 489.0,
    d_port_in: 19.25,
    strokeStd_mm: 240,
    strokeStd_in: 9.5,
    strokeExt_mm: 300,
    strokeExt_in: 12.0,
    stemDiaStd_mm: 60,
    stemDiaHeavy_mm: 75,
    cageWallStd_mm: 38.0,
    bodyMinWall_mm: {
      CL150_PN16: 31.0,
      CL300_PN40: 40.5,
      CL600_PN100: 56.0,
      CL900_PN160: 72.0,
      CL1500_PN250: 95.0,
      CL2500_PN420: 130.0,
    },
    faceToFaceCL300_mm: 1250,
    ratedCvBaseline: {
      CONTOURED_LINEAR: 5930.0,
      CONTOURED_EQP: 5190.0,
      WINDOW_CAGE: 5560.0,
      CAGE_1STAGE: 4260.0,
      CAGE_2STAGE: 2965.0,
      CAGE_3STAGE: 1850.0,
    },
  },
  {
    dn: 600,
    npsLabel: '24"',
    d_in: 24.0,
    d_mm: 600,
    d_port_mm: 590.6,
    d_port_in: 23.25,
    strokeStd_mm: 300,
    strokeStd_in: 12.0,
    strokeExt_mm: 380,
    strokeExt_in: 15.0,
    stemDiaStd_mm: 65,
    stemDiaHeavy_mm: 85,
    cageWallStd_mm: 44.0,
    bodyMinWall_mm: {
      CL150_PN16: 36.0,
      CL300_PN40: 47.0,
      CL600_PN100: 65.0,
      CL900_PN160: 84.0,
      CL1500_PN250: 110.0,
      CL2500_PN420: 150.0,
    },
    faceToFaceCL300_mm: 1480,
    ratedCvBaseline: {
      CONTOURED_LINEAR: 8650.0,
      CONTOURED_EQP: 7570.0,
      WINDOW_CAGE: 8110.0,
      CAGE_1STAGE: 6215.0,
      CAGE_2STAGE: 4325.0,
      CAGE_3STAGE: 2700.0,
    },
  },
];

export const REDUCED_TRIM_FACTORS: { label: string; factor: number; boreMultiplier: number }[] = [
  { label: '100% (Full Port)', factor: 1.0, boreMultiplier: 1.0 },
  { label: '63% (1-Step Reduced — R5)', factor: 0.63, boreMultiplier: 0.794 },
  { label: '40% (2-Step Reduced — R5)', factor: 0.40, boreMultiplier: 0.632 },
  { label: '25% (3-Step Reduced — R5)', factor: 0.25, boreMultiplier: 0.50 },
  { label: '16% (4-Step Reduced — R5)', factor: 0.16, boreMultiplier: 0.40 },
  { label: '10% (Micro / Low-Flow Port)', factor: 0.10, boreMultiplier: 0.316 },
];

export interface CorrelatedValveParameters {
  dn: number;
  npsLabel: string;
  d_mm: number;
  d_in: number;
  d_port_mm: number;
  d_port_in: number;
  stroke_mm: number;
  stroke_in: number;
  minRecommendedStroke_mm: number;
  curtainToSeatAreaRatio: number;
  ratedCv: number;
  ratedKv: number;
  effectiveCd: number; // Cv / d_in^2
  cvTrimComponent: number;
  cvSeatComponent: number;
  cvBodyComponent: number;
  FL: number;
  Kc: number;
  xT: number;
  Fd: number;
  bodyMinWall_mm: number;
  stemDiaRecommended_mm: number;
  cageWallRecommended_mm: number;
}

/**
 * First-Principles Manufacturer-Agnostic Correlation Engine
 * Links Nominal Size (d), Pressure Class, Body Style, Trim Style, Reduced Trim Factor,
 * Seat Bore (d_port), and Rated Stroke (H) to Rated Cv, Kv, and Series Resistance components.
 */
export function computeCorrelatedValveParameters(params: {
  dn: number;
  pressureClass: PressureClassId;
  bodyStyle: BodyStyleId;
  trimStyle: TrimStyleId;
  flowDirection: FlowDirectionId;
  reducedTrimFactor: number;
  useExtendedStroke: boolean;
  customBoreOverride_mm?: number | null;
  customStrokeOverride_mm?: number | null;
  customRatedCvOverride?: number | null;
  customFLOverride?: number | null;
  customXTOverride?: number | null;
}): CorrelatedValveParameters {
  const sizeSpec =
    GENERIC_VALVE_SCHEDULE.find((s) => s.dn === params.dn) || GENERIC_VALVE_SCHEDULE[4]; // Default DN50
  const classSpec = PRESSURE_CLASSES[params.pressureClass];
  const trimSpec = TRIM_STYLES[params.trimStyle];

  const boreMultiplier = Math.sqrt(Math.max(0.05, params.reducedTrimFactor));
  const classBoreScale = Math.sqrt(classSpec.capacityMultiplierKClass);

  const d_port_mm =
    params.customBoreOverride_mm && params.customBoreOverride_mm > 0
      ? params.customBoreOverride_mm
      : Number((sizeSpec.d_port_mm * boreMultiplier * classBoreScale).toFixed(1));
  const d_port_in = d_port_mm / 25.4;

  const defaultStroke_mm = params.useExtendedStroke
    ? sizeSpec.strokeExt_mm
    : sizeSpec.strokeStd_mm;
  const stroke_mm =
    params.customStrokeOverride_mm && params.customStrokeOverride_mm > 0
      ? params.customStrokeOverride_mm
      : defaultStroke_mm;
  const stroke_in = stroke_mm / 25.4;

  // Minimum stroke so cylindrical curtain area (pi * d_port * H * eta_open) >= seat area (pi/4 * d_port^2)
  const minRecommendedStroke_mm = Number(
    (d_port_mm / (4.0 * trimSpec.openAreaRatioEta)).toFixed(1)
  );
  const seatArea_mm2 = (Math.PI / 4) * d_port_mm * d_port_mm;
  const curtainArea_mm2 = Math.PI * d_port_mm * stroke_mm * trimSpec.openAreaRatioEta;
  const curtainToSeatAreaRatio = Number((curtainArea_mm2 / Math.max(1, seatArea_mm2)).toFixed(2));

  // Body style multiplier
  const K_body = params.bodyStyle === 'ANGLE_BODY' ? 1.12 : 1.0;

  // Series Resistance Components:
  // 1. Trim window/orifice capacity (scales with curtain area or baseline Cd)
  const strokeScale = Math.min(1.25, Math.max(0.55, Math.pow(stroke_mm / defaultStroke_mm, 0.45)));
  const baselineCv =
    sizeSpec.ratedCvBaseline[params.trimStyle] *
    classSpec.capacityMultiplierKClass *
    K_body *
    params.reducedTrimFactor *
    strokeScale;

  // Seat ring capacity: Cv_seat = 0.0462 * d_port_mm^2 (~ 29.8 * d_port_in^2)
  const cvSeatComponent = 0.0462 * d_port_mm * d_port_mm;

  // Body gallery capacity: Cv_body = (22 for Globe, 26 for Angle) * d_in^2 * K_class
  const bodyCoeff = params.bodyStyle === 'ANGLE_BODY' ? 26.0 : 22.0;
  const cvBodyComponent =
    bodyCoeff * sizeSpec.d_in * sizeSpec.d_in * classSpec.capacityMultiplierKClass;

  // Derive Cv_trim so composite series resistance matches correlated baselineCv (or custom override)
  const ratedCv =
    params.customRatedCvOverride && params.customRatedCvOverride > 0
      ? params.customRatedCvOverride
      : Number(baselineCv.toFixed(1));
  const ratedKv = Number((0.865 * ratedCv).toFixed(1));

  const invSeatBodySq =
    1 / Math.pow(Math.max(0.1, cvSeatComponent), 2) +
    1 / Math.pow(Math.max(0.1, cvBodyComponent), 2);
  const invRatedSq = 1 / Math.pow(Math.max(0.1, ratedCv), 2);
  const cvTrimComponent =
    invRatedSq > invSeatBodySq
      ? Number((1 / Math.sqrt(invRatedSq - invSeatBodySq)).toFixed(1))
      : Number((ratedCv * 1.15).toFixed(1));

  const effectiveCd = Number((ratedCv / (sizeSpec.d_in * sizeSpec.d_in)).toFixed(2));

  const FL =
    params.customFLOverride && params.customFLOverride > 0
      ? Math.min(0.99, Math.max(0.2, params.customFLOverride))
      : params.flowDirection === 'FTO'
      ? trimSpec.FL_FTO
      : trimSpec.FL_FTC;
  const Kc = params.flowDirection === 'FTO' ? trimSpec.Kc_FTO : trimSpec.Kc_FTC;
  const xT =
    params.customXTOverride && params.customXTOverride > 0
      ? Math.min(0.99, Math.max(0.05, params.customXTOverride))
      : params.flowDirection === 'FTO'
      ? trimSpec.xT_FTO
      : trimSpec.xT_FTC;

  const bodyMinWall_mm = sizeSpec.bodyMinWall_mm[params.pressureClass];
  const stemDiaRecommended_mm =
    classSpec.asmeClass >= 600 ? sizeSpec.stemDiaHeavy_mm : sizeSpec.stemDiaStd_mm;
  const cageWallRecommended_mm = Number(
    (sizeSpec.cageWallStd_mm * classSpec.cageWallFactor).toFixed(1)
  );

  return {
    dn: sizeSpec.dn,
    npsLabel: sizeSpec.npsLabel,
    d_mm: sizeSpec.d_mm,
    d_in: sizeSpec.d_in,
    d_port_mm,
    d_port_in: Number(d_port_in.toFixed(2)),
    stroke_mm,
    stroke_in: Number(stroke_in.toFixed(2)),
    minRecommendedStroke_mm,
    curtainToSeatAreaRatio,
    ratedCv,
    ratedKv,
    effectiveCd,
    cvTrimComponent,
    cvSeatComponent: Number(cvSeatComponent.toFixed(1)),
    cvBodyComponent: Number(cvBodyComponent.toFixed(1)),
    FL,
    Kc,
    xT,
    Fd: trimSpec.Fd_default,
    bodyMinWall_mm,
    stemDiaRecommended_mm,
    cageWallRecommended_mm,
  };
}

/**
 * Evaluates stroke- and flow-direction-dependent pressure recovery & choked flow factors
 * per Parcol Bulletin 1-I (Fig. 6) and Warren Controls VSSTR-07/12 (Table 3).
 * At lower travel %, throttling at the seat metering edge increases FL(h); at 100% open it converges to FL_rated.
 */
export function evaluateStrokeDependentRecovery(params: {
  FL_rated: number;
  Kc_rated: number;
  xT_rated: number;
  travelPct: number;
  stages: number;
  flowDirection: FlowDirectionId;
}): { FL_atTravel: number; Kc_atTravel: number; xT_atTravel: number } {
  const h = Math.max(0.05, Math.min(1.0, params.travelPct / 100));
  const lowLiftBoost = params.stages >= 2 ? 0.02 : 0.06;
  const directionShape =
    params.stages === 1 && params.flowDirection === 'FTC'
      ? 1 - Math.pow(h, 0.85)
      : 1 - Math.pow(h, 1.35);

  const FL_atTravel = Math.min(
    0.99,
    Math.max(0.35, params.FL_rated + lowLiftBoost * directionShape)
  );
  const ratio = FL_atTravel / Math.max(0.2, params.FL_rated);
  const Kc_atTravel = Math.min(0.98, Math.max(0.25, params.Kc_rated * ratio * ratio));
  const xT_atTravel = Math.min(0.95, Math.max(0.15, params.xT_rated * Math.pow(ratio, 1.3)));

  return {
    FL_atTravel: Number(FL_atTravel.toFixed(3)),
    Kc_atTravel: Number(Kc_atTravel.toFixed(3)),
    xT_atTravel: Number(xT_atTravel.toFixed(3)),
  };
}

export interface RotaryValveBenchmarkSpec {
  id: string;
  styleName: string;
  motionType: string;
  cdSpecificCapacity: number; // Cv / d_in^2 at 90 deg open
  FL_90deg: number;
  Kc_90deg: number;
  xT_90deg: number;
  Fd_typical: number;
  rangeability: string;
  rangeabilityValue: number;
  characteristic: string;
  notes: string;
}

/**
 * Rotary Control Valve Benchmarks (CED Engineering M04-034, Warren Table 1, Baumann Ch. 5 & Neles)
 * Provided in Tab 6 Master Schedule for linear globe/cage vs. high-capacity rotary comparison.
 */
export const ROTARY_VALVE_BENCHMARKS: RotaryValveBenchmarkSpec[] = [
  {
    id: 'ROTARY_ECCENTRIC_PLUG',
    styleName: 'Eccentric Rotary Plug Valve',
    motionType: '90° Rotary Cammed Plug',
    cdSpecificCapacity: 24.0,
    FL_90deg: 0.68,
    Kc_90deg: 0.52,
    xT_90deg: 0.55,
    Fd_typical: 0.42,
    rangeability: '100:1',
    rangeabilityValue: 100,
    characteristic: 'Modified Linear / Equal-%',
    notes: 'Cammed eccentric plug clears seat immediately to cut breakaway torque; good erosive & slurry capability.',
  },
  {
    id: 'ROTARY_SEGMENTED_VBALL',
    styleName: 'Segmented V-Notch Ball Valve',
    motionType: '90° Characterized Ball Segment',
    cdSpecificCapacity: 30.0,
    FL_90deg: 0.62,
    Kc_90deg: 0.46,
    xT_90deg: 0.42,
    Fd_typical: 0.45,
    rangeability: '200:1',
    rangeabilityValue: 200,
    characteristic: 'Equal-%',
    notes: 'Shearing V-notch action provides ultra-wide 200:1 rangeability and fibrous/viscous service capability.',
  },
  {
    id: 'ROTARY_HP_BUTTERFLY',
    styleName: 'High-Performance Eccentric Butterfly',
    motionType: '90° Double-Offset Disc',
    cdSpecificCapacity: 32.0,
    FL_90deg: 0.58,
    Kc_90deg: 0.40,
    xT_90deg: 0.35,
    Fd_typical: 0.48,
    rangeability: '50:1',
    rangeabilityValue: 50,
    characteristic: 'Linear / Modified Equal-%',
    notes: 'High-capacity low-recovery disc (low FL); throttle typically restricted to 15°–70° for dynamic torque stability.',
  },
  {
    id: 'ROTARY_FULL_BORE_BALL',
    styleName: 'Full-Bore Trunnion Control Ball',
    motionType: '90° Full-Port Ball (Multi-Attenuator Opt.)',
    cdSpecificCapacity: 42.0,
    FL_90deg: 0.52,
    Kc_90deg: 0.34,
    xT_90deg: 0.25,
    Fd_typical: 0.90,
    rangeability: '150:1',
    rangeabilityValue: 150,
    characteristic: 'Equal-%',
    notes: 'Maximum Cd with minimal permanent pressure loss; requires anti-cavitation/noise trim plates at high ΔP ratios.',
  },
];
