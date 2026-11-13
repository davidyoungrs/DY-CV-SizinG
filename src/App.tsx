import React, { useState, useMemo } from 'react';
import {
  Activity,
  Sliders,
  Cpu,
  Thermometer,
  ShieldAlert,
  Table,
  Download,
  FileCode,
  Printer,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  Trash2,
  Layers,
  Gauge,
  Volume2,
  Wrench,
} from 'lucide-react';

import {
  PRESSURE_CLASSES,
  TRIM_STYLES,
  GENERIC_VALVE_SCHEDULE,
  REDUCED_TRIM_FACTORS,
  PressureClassId,
  TrimStyleId,
  BodyStyleId,
  FlowDirectionId,
  computeCorrelatedValveParameters,
} from './engine/valveSchedule';

import {
  OperatingPointInput,
  PipingConfiguration,
  FLUID_PRESETS,
  evaluateOperatingCase,
} from './engine/iec60534Sizing';

import {
  recommendValveSizeAndRating,
  ValveSelectionRecommendation,
} from './engine/valveRecommender';

import {
  CharacteristicConfig,
  CharacteristicTypeId,
  simulateCharacteristicCurves,
} from './engine/characteristicEngine';

import {
  CAGE_MATERIALS,
  CageMaterialId,
  synthesizeDrilledCageAndStress,
  evaluateSibandaLocalHoleFactor,
  generateUnrolledCageDXF,
  generate4AxisCageGCode,
} from './engine/cageSynthesisAndStress';

import {
  THERMAL_ALLOYS,
  ThermalAlloyId,
  simulateTransientThermalBinding,
} from './engine/transientThermalEngine';

import {
  STEM_MATERIALS,
  StemMaterialId,
  ShutoffClassId,
  PackingTypeId,
  BalanceSealTypeId,
  FailActionId,
  STANDARD_METRIC_STEM_DIAMETERS_MM,
  evaluateActuatorAndStemSizing,
} from './engine/actuatorAndStemEngine';

type ActiveTabId =
  | 'PROCESS_SIZING'
  | 'CHARACTERISTICS'
  | 'CAGE_CAD_STRESS'
  | 'TRANSIENT_THERMAL'
  | 'ACTUATOR_STEM'
  | 'MASTER_SCHEDULE';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTabId>('PROCESS_SIZING');

  // 1. Global Manufacturer-Agnostic Valve Configuration State
  const [selectedDN, setSelectedDN] = useState<number>(80); // DN80 (3") default
  const [pressureClass, setPressureClass] = useState<PressureClassId>('CL300_PN40');
  const [bodyStyle, setBodyStyle] = useState<BodyStyleId>('GLOBE_STRAIGHT');
  const [trimStyle, setTrimStyle] = useState<TrimStyleId>('CONTOURED_LINEAR'); // Default linear trim
  const [flowDirection, setFlowDirection] = useState<FlowDirectionId>('FTO');
  const [reducedTrimFactor, setReducedTrimFactor] = useState<number>(1.0);
  const [useExtendedStroke, setUseExtendedStroke] = useState<boolean>(false);
  const [customBoreOverride, setCustomBoreOverride] = useState<number | null>(null);
  const [customStrokeOverride, setCustomStrokeOverride] = useState<number | null>(null);
  const [customRatedCvOverride, setCustomRatedCvOverride] = useState<number | null>(null);

  // 2. Piping & Multi-Condition Process State
  const [piping, setPiping] = useState<PipingConfiguration>({
    upstreamPipeID_mm: 102.3, // 4" Sch 40
    downstreamPipeID_mm: 102.3,
    pipeWallThickness_mm: 6.02,
    upstreamPipeLength_m: 85,
    actuatorCloseTime_s: 3.5,
    bodyMaterialCategory: 'STAINLESS_ALLOY',
  });

  const [operatingCases, setOperatingCases] = useState<OperatingPointInput[]>([
    {
      id: 'case-min',
      label: 'Min Turndown',
      enabled: true,
      fluidPhase: 'LIQUID',
      flowRate: 28,
      P1_bar_a: 34.0,
      P2_bar_a: 18.5,
      T1_degC: 185,
      rho_kg_m3: 881.5,
      Pv_bar_a: 11.23,
      Pc_bar_a: 220.6,
      viscosity_cSt: 0.165,
      speedOfSound_m_s: 1360,
      molecularWeight: 18.015,
      gammaCpCv: 1.32,
      compressibilityZ: 1.0,
    },
    {
      id: 'case-norm',
      label: 'Normal Design',
      enabled: true,
      fluidPhase: 'LIQUID',
      flowRate: 115,
      P1_bar_a: 31.0,
      P2_bar_a: 19.5,
      T1_degC: 185,
      rho_kg_m3: 881.5,
      Pv_bar_a: 11.23,
      Pc_bar_a: 220.6,
      viscosity_cSt: 0.165,
      speedOfSound_m_s: 1360,
      molecularWeight: 18.015,
      gammaCpCv: 1.32,
      compressibilityZ: 1.0,
    },
    {
      id: 'case-max',
      label: 'Max Rated',
      enabled: true,
      fluidPhase: 'LIQUID',
      flowRate: 175,
      P1_bar_a: 28.5,
      P2_bar_a: 20.5,
      T1_degC: 185,
      rho_kg_m3: 881.5,
      Pv_bar_a: 11.23,
      Pc_bar_a: 220.6,
      viscosity_cSt: 0.165,
      speedOfSound_m_s: 1360,
      molecularWeight: 18.015,
      gammaCpCv: 1.32,
      compressibilityZ: 1.0,
    },
    {
      id: 'case-upset',
      label: 'Start-Up / High-ΔP Letdown',
      enabled: true,
      fluidPhase: 'LIQUID',
      flowRate: 65,
      P1_bar_a: 36.0,
      P2_bar_a: 14.5,
      T1_degC: 185,
      rho_kg_m3: 881.5,
      Pv_bar_a: 11.23,
      Pc_bar_a: 220.6,
      viscosity_cSt: 0.165,
      speedOfSound_m_s: 1360,
      molecularWeight: 18.015,
      gammaCpCv: 1.32,
      compressibilityZ: 1.0,
    },
  ]);

  // 3. Flow Characteristic & Installed Loop State (Defaulting on LINEAR as requested)
  const [charConfig, setCharConfig] = useState<CharacteristicConfig>({
    type: 'LINEAR',
    equalPctRangeability: 50,
    biLinearKneeTravelPct: 35,
    biLinearKneeCvPct: 12,
    valveAuthorityPv: 0.35,
    customPoints: [
      { travelPct: 0, cvPct: 0 },
      { travelPct: 20, cvPct: 20 },
      { travelPct: 40, cvPct: 40 },
      { travelPct: 60, cvPct: 60 },
      { travelPct: 80, cvPct: 80 },
      { travelPct: 100, cvPct: 100 },
    ],
  });

  // 4. Drilled Cage Synthesis & Hoop Stress State
  const [numRows, setNumRows] = useState<number>(12);
  const [baseHoleDia_mm, setBaseHoleDia_mm] = useState<number>(4.2);
  const [modulateHoleDiameter, setModulateHoleDiameter] = useState<boolean>(true);
  const [enforceZeroDeadbandOverlap, setEnforceZeroDeadbandOverlap] = useState<boolean>(true);
  const [targetRowOverlapPct, setTargetRowOverlapPct] = useState<number>(28);
  const [showSibandaGalleryHeatmap, setShowSibandaGalleryHeatmap] = useState<boolean>(true);
  const [selectedWallThickness_mm, setSelectedWallThickness_mm] = useState<number>(10.5);
  const [erosionAllowance_mm, setErosionAllowance_mm] = useState<number>(1.0);
  const [cageMaterial, setCageMaterial] = useState<CageMaterialId>('SS410_HT');
  const [requireNaceSourService, setRequireNaceSourService] = useState<boolean>(false);
  const [livePlugTravelPct, setLivePlugTravelPct] = useState<number>(68);

  // 5. Transient Thermal Binding State
  const [coldRadialClearance_mm, setColdRadialClearance_mm] = useState<number>(0.18);
  const [axialGasketAllowance_mm, setAxialGasketAllowance_mm] = useState<number>(0.25);
  const [plugAlloy, setPlugAlloy] = useState<ThermalAlloyId>('CF8M_316SS');
  const [cageAlloy, setCageAlloy] = useState<ThermalAlloyId>('SS410_MARTENSITIC');
  const [bodyAlloy, setBodyAlloy] = useState<ThermalAlloyId>('WC9_CR_MO');
  const [initialTemp_degC, setInitialTemp_degC] = useState<number>(25);
  const [finalProcessTemp_degC, setFinalProcessTemp_degC] = useState<number>(420);
  const [rampRate_degC_per_min, setRampRate_degC_per_min] = useState<number>(45);
  const [convectiveH_W_m2K, setConvectiveH_W_m2K] = useState<number>(2400);
  const [requireLethalBellowsSeal, setRequireLethalBellowsSeal] = useState<boolean>(false);

  // 6. Actuator Thrust, Bench Set & Stem Sizing State
  const [selectedStemDia_mm, setSelectedStemDia_mm] = useState<number>(20);
  const [unsupportedStemLength_mm, setUnsupportedStemLength_mm] = useState<number>(240);
  const [shutoffClass, setShutoffClass] = useState<ShutoffClassId>('CLASS_IV');
  const [packingType, setPackingType] = useState<PackingTypeId>('DOUBLE_PTFE_LIVE_LOADED');
  const [balanceSealType, setBalanceSealType] = useState<BalanceSealTypeId>('PTFE_SPRING_ENERGIZED');
  const [failAction, setFailAction] = useState<FailActionId>('FAIL_CLOSED_ATO');
  const [actuatorArea_cm2, setActuatorArea_cm2] = useState<number>(530);
  const [airSupply_bar_g, setAirSupply_bar_g] = useState<number>(4.0);
  const [benchSetLower_bar_g, setBenchSetLower_bar_g] = useState<number>(0.9);
  const [benchSetUpper_bar_g, setBenchSetUpper_bar_g] = useState<number>(2.5);
  const [stemMaterial, setStemMaterial] = useState<StemMaterialId>('XM19_NITRONIC50');

  // --- COMPUTED ENGINEERING RESULTS ---
  const correlatedValve = useMemo(
    () =>
      computeCorrelatedValveParameters({
        dn: selectedDN,
        pressureClass,
        bodyStyle,
        trimStyle,
        flowDirection,
        reducedTrimFactor,
        useExtendedStroke,
        customBoreOverride_mm: customBoreOverride,
        customStrokeOverride_mm: customStrokeOverride,
        customRatedCvOverride: customRatedCvOverride,
      }),
    [
      selectedDN,
      pressureClass,
      bodyStyle,
      trimStyle,
      flowDirection,
      reducedTrimFactor,
      useExtendedStroke,
      customBoreOverride,
      customStrokeOverride,
      customRatedCvOverride,
    ]
  );

  const maxShutoffDeltaP_bar = useMemo(() => {
    const maxP1 = Math.max(...operatingCases.map((c) => c.P1_bar_a), 25);
    return Number(maxP1.toFixed(1));
  }, [operatingCases]);

  const maxOperatingTemp_degC = useMemo(() => {
    return Math.max(...operatingCases.map((c) => c.T1_degC), finalProcessTemp_degC);
  }, [operatingCases, finalProcessTemp_degC]);

  const cageSynthesis = useMemo(
    () =>
      synthesizeDrilledCageAndStress({
        cageID_mm: correlatedValve.d_port_mm,
        stroke_mm: correlatedValve.stroke_mm,
        targetTrimCv: correlatedValve.cvTrimComponent,
        cvSeatComponent: correlatedValve.cvSeatComponent,
        cvBodyComponent: correlatedValve.cvBodyComponent,
        orificeDischargeCoeff: TRIM_STYLES[trimStyle].orificeDischargeCoeff,
        characteristicConfig: charConfig,
        numRows,
        baseHoleDia_mm,
        modulateHoleDiameter,
        enforceZeroDeadbandOverlap,
        targetRowOverlapPct,
        selectedWallThickness_mm,
        erosionAllowance_mm,
        shutoffDeltaP_bar: maxShutoffDeltaP_bar,
        operatingTemp_degC: maxOperatingTemp_degC,
        materialId: cageMaterial,
        requireNaceSourService,
      }),
    [
      correlatedValve,
      trimStyle,
      charConfig,
      numRows,
      baseHoleDia_mm,
      modulateHoleDiameter,
      enforceZeroDeadbandOverlap,
      targetRowOverlapPct,
      selectedWallThickness_mm,
      erosionAllowance_mm,
      maxShutoffDeltaP_bar,
      maxOperatingTemp_degC,
      cageMaterial,
      requireNaceSourService,
    ]
  );

  const caseResults = useMemo(
    () =>
      operatingCases
        .filter((c) => c.enabled)
        .map((point) =>
          evaluateOperatingCase({
            point,
            piping,
            valveD_mm: correlatedValve.d_mm,
            seatPort_mm: correlatedValve.d_port_mm,
            ratedCv: correlatedValve.ratedCv,
            FL: correlatedValve.FL,
            Kc: correlatedValve.Kc,
            xT: correlatedValve.xT,
            Fd: cageSynthesis.styleModifierFd,
            stages: TRIM_STYLES[trimStyle].stages,
            drilledHoleDia_mm: cageSynthesis.meanHoleDia_mm,
            characteristicType: charConfig.type,
            equalPctRangeability: charConfig.equalPctRangeability,
          })
        ),
    [operatingCases, piping, correlatedValve, cageSynthesis, trimStyle, charConfig]
  );

  // Automated Valve Size & Pressure Rating Recommender based on all process conditions
  const valveRecommendation = useMemo(
    () =>
      recommendValveSizeAndRating({
        cases: operatingCases,
        piping,
        trimStyle,
        bodyStyle,
        flowDirection,
        reducedTrimFactor,
        useExtendedStroke,
      }),
    [operatingCases, piping, trimStyle, bodyStyle, flowDirection, reducedTrimFactor, useExtendedStroke]
  );

  const charSimulation = useMemo(
    () =>
      simulateCharacteristicCurves({
        config: charConfig,
        ratedCv: correlatedValve.ratedCv,
        stroke_mm: correlatedValve.stroke_mm,
        maxSystemDeltaP_bar: maxShutoffDeltaP_bar,
      }),
    [charConfig, correlatedValve, maxShutoffDeltaP_bar]
  );

  const thermalResult = useMemo(
    () =>
      simulateTransientThermalBinding({
        plugGuideNominalDia_mm: correlatedValve.d_port_mm,
        cageSleeveHeight_mm: correlatedValve.stroke_mm * 1.45,
        bodyMinWall_mm: correlatedValve.bodyMinWall_mm,
        cageWall_mm: selectedWallThickness_mm,
        coldRadialClearance_mm,
        axialGasketCrushAllowance_mm: axialGasketAllowance_mm,
        plugAlloy,
        cageAlloy,
        bodyAlloy,
        initialTemp_degC,
        finalProcessTemp_degC,
        rampRate_degC_per_min,
        convectiveHeatTransferCoeff_W_m2K: convectiveH_W_m2K,
        requireLethalBellowsSeal,
      }),
    [
      correlatedValve,
      selectedWallThickness_mm,
      coldRadialClearance_mm,
      axialGasketAllowance_mm,
      plugAlloy,
      cageAlloy,
      bodyAlloy,
      initialTemp_degC,
      finalProcessTemp_degC,
      rampRate_degC_per_min,
      convectiveH_W_m2K,
      requireLethalBellowsSeal,
    ]
  );

  const actuatorStemResult = useMemo(
    () =>
      evaluateActuatorAndStemSizing({
        seatPortDia_mm: correlatedValve.d_port_mm,
        cageGuideDia_mm: correlatedValve.d_port_mm + 4,
        selectedStemDia_mm,
        unsupportedStemLength_mm,
        stroke_mm: correlatedValve.stroke_mm,
        shutoffDeltaP_bar: maxShutoffDeltaP_bar,
        downstreamShutoffP2_bar_g: Math.max(
          0,
          Math.min(...operatingCases.map((c) => c.P2_bar_a)) - 1.013
        ),
        operatingTemp_degC: maxOperatingTemp_degC,
        flowDirection,
        shutoffClass,
        packingType,
        balanceSealType,
        hasMetallicBellows: requireLethalBellowsSeal,
        bellowsEffectiveArea_cm2: 14.5,
        bellowsSpringRate_N_mm: 42,
        failAction,
        actuatorEffectiveArea_cm2: actuatorArea_cm2,
        airSupplyPressure_bar_g: airSupply_bar_g,
        benchSetLower_bar_g,
        benchSetUpper_bar_g,
        stemMaterial,
      }),
    [
      correlatedValve,
      selectedStemDia_mm,
      unsupportedStemLength_mm,
      maxShutoffDeltaP_bar,
      operatingCases,
      maxOperatingTemp_degC,
      flowDirection,
      shutoffClass,
      packingType,
      balanceSealType,
      requireLethalBellowsSeal,
      failAction,
      actuatorArea_cm2,
      airSupply_bar_g,
      benchSetLower_bar_g,
      benchSetUpper_bar_g,
      stemMaterial,
    ]
  );

  // --- HELPER HANDLERS ---
  const handleSelectSizeFromSchedule = (dn: number) => {
    setSelectedDN(dn);
    const spec = GENERIC_VALVE_SCHEDULE.find((s) => s.dn === dn);
    if (spec) {
      setCustomBoreOverride(null);
      setCustomStrokeOverride(null);
      setCustomRatedCvOverride(null);
      setSelectedWallThickness_mm(spec.cageWallStd_mm);
      setSelectedStemDia_mm(spec.stemDiaStd_mm);
      setPiping((prev) => ({
        ...prev,
        upstreamPipeID_mm: Number((spec.d_mm * 1.25).toFixed(1)),
        downstreamPipeID_mm: Number((spec.d_mm * 1.25).toFixed(1)),
      }));
    }
  };

  const applyFluidPresetToAllCases = (presetId: string) => {
    const preset = FLUID_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setOperatingCases((prev) =>
      prev.map((c) => ({
        ...c,
        fluidPhase: preset.phase,
        T1_degC: preset.defaultT1_degC,
        rho_kg_m3: preset.rho_kg_m3,
        Pv_bar_a: preset.Pv_bar_a,
        Pc_bar_a: preset.Pc_bar_a,
        viscosity_cSt: preset.viscosity_cSt,
        speedOfSound_m_s: preset.speedOfSound_m_s,
        molecularWeight: preset.molecularWeight,
        gammaCpCv: preset.gammaCpCv,
        compressibilityZ: preset.compressibilityZ,
      }))
    );
    setFinalProcessTemp_degC(preset.defaultT1_degC);
    if (preset.id === 'LIQUID_CHLORINE') {
      setRequireLethalBellowsSeal(true);
    }
  };

  const downloadTextFile = (filename: string, content: string, mime = 'text/plain') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportDXF = () => {
    const dxf = generateUnrolledCageDXF(cageSynthesis);
    downloadTextFile(`DY_SIZE_DN${selectedDN}_CAGE_UNROLLED.dxf`, dxf, 'application/dxf');
  };

  const handleExportGCode = () => {
    const gcode = generate4AxisCageGCode(cageSynthesis);
    downloadTextFile(`DY_SIZE_DN${selectedDN}_4AXIS_DRILL.nc`, gcode, 'text/plain');
  };

  const handleExportCSV = () => {
    const headers = [
      'Row',
      'Z_Elevation_mm',
      'Travel_Pct',
      'Hole_Dia_mm',
      'Hole_Count',
      'Pitch_mm',
      'Pitch_to_Dia',
      'Ligament_Width_mm',
      'Ligament_Efficiency',
      'Row_Area_mm2',
      'Cumulative_Area_mm2',
      'Cumulative_Cv',
    ].join(',');
    const lines = cageSynthesis.rows.map((r) =>
      [
        r.rowIndex,
        r.zElevation_mm,
        r.travelPctAtRowCenter,
        r.holeDia_mm,
        r.holeCount,
        r.circumferentialPitch_mm,
        r.pitchToDiaRatio,
        r.ligamentWidth_mm,
        r.ligamentEfficiency,
        r.rowArea_mm2,
        r.cumulativeArea_mm2,
        r.cumulativeCv,
      ].join(',')
    );
    downloadTextFile(
      `DY_SIZE_DN${selectedDN}_CAGE_SCHEDULE.csv`,
      [headers, ...lines].join('\n'),
      'text/csv'
    );
  };

  const renderStatusBadge = (status: 'PASS' | 'WARNING' | 'CRITICAL', text?: string) => {
    if (status === 'PASS') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-700/60">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {text || 'PASS'}
        </span>
      );
    }
    if (status === 'WARNING') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-amber-950/80 text-amber-400 border border-amber-700/60">
          <AlertTriangle className="w-3.5 h-3.5" />
          {text || 'WARNING'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-red-950/80 text-red-400 border border-red-700/60">
        <XCircle className="w-3.5 h-3.5" />
        {text || 'CRITICAL'}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col">
      {/* STICKY GLASSMORPHIC TOP HEADER (Matched to NotebookLM Studio Dashboards) */}
      <header className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur-md border-b border-slate-800 px-6 py-3.5 no-print">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-950/50">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-bold tracking-tight text-slate-100">
                  DY-SIZE // CONTROL VALVE & DRILLED CAGE CAE SUITE
                </h1>
                <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 font-mono text-[11px] font-semibold">
                  IEC 60534 • ASME B16.34 • ISA-75
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                Manufacturer-Agnostic Valve Correlation • Installed Gain • Hoop Stress • Transient Thermal • Actuator/Stem
              </p>
            </div>
          </div>

          {/* EXPORT & ACTION TOOLBAR */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportDXF}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-xs font-mono transition"
              title="Download 2D Unrolled Cage Perforation AutoCAD .DXF"
            >
              <Download className="w-3.5 h-3.5" />
              .DXF CAD
            </button>
            <button
              onClick={handleExportGCode}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700 text-xs font-mono transition"
              title="Download 4-Axis Rotary Indexer CNC .NC G-Code"
            >
              <FileCode className="w-3.5 h-3.5" />
              4-AXIS G-CODE
            </button>
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-mono transition"
            >
              <Table className="w-3.5 h-3.5" />
              .CSV SCHEDULE
            </button>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs font-mono shadow-lg shadow-cyan-900/30 transition"
            >
              <Printer className="w-3.5 h-3.5" />
              PRINT DATASHEET
            </button>
          </div>
        </div>
      </header>

      {/* GLOBAL VALVE HARDWARE & CORRELATION BANNER */}
      <section className="bg-slate-900/60 border-b border-slate-800/80 px-6 py-4">
        <div className="max-w-[1600px] mx-auto space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Nominal Valve Size */}
            <div className="bg-slate-800/70 rounded-lg p-2.5 border border-slate-700/70">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                Nominal Valve Size (DN / NPS)
              </label>
              <select
                value={selectedDN}
                onChange={(e) => handleSelectSizeFromSchedule(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-cyan-300 focus:border-cyan-500 focus:outline-none"
              >
                {GENERIC_VALVE_SCHEDULE.map((s) => (
                  <option key={s.dn} value={s.dn}>
                    DN{s.dn} ({s.npsLabel}) — Bore Ø{s.d_port_mm}mm
                  </option>
                ))}
              </select>
            </div>

            {/* Pressure Rating Class */}
            <div className="bg-slate-800/70 rounded-lg p-2.5 border border-slate-700/70">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                Pressure Class (ASME / PN)
              </label>
              <select
                value={pressureClass}
                onChange={(e) => setPressureClass(e.target.value as PressureClassId)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
              >
                {Object.values(PRESSURE_CLASSES).map((pc) => (
                  <option key={pc.id} value={pc.id}>
                    {pc.label} (K_class={pc.capacityMultiplierKClass.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            {/* Generic Trim Family */}
            <div className="bg-slate-800/70 rounded-lg p-2.5 border border-slate-700/70">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                Generic Trim Style & Stages
              </label>
              <select
                value={trimStyle}
                onChange={(e) => setTrimStyle(e.target.value as TrimStyleId)}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-cyan-300 focus:border-cyan-500 focus:outline-none"
              >
                {Object.values(TRIM_STYLES).map((ts) => (
                  <option key={ts.id} value={ts.id}>
                    {ts.shortName} (Cd≈{ts.cdSpecificCapacity})
                  </option>
                ))}
              </select>
            </div>

            {/* Reduced Trim Capacity Step */}
            <div className="bg-slate-800/70 rounded-lg p-2.5 border border-slate-700/70">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                Trim Capacity Factor (R5 Series)
              </label>
              <select
                value={reducedTrimFactor}
                onChange={(e) => {
                  setReducedTrimFactor(Number(e.target.value));
                  setCustomBoreOverride(null);
                  setCustomRatedCvOverride(null);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
              >
                {REDUCED_TRIM_FACTORS.map((rf) => (
                  <option key={rf.factor} value={rf.factor}>
                    {rf.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Body Pattern & Flow Direction */}
            <div className="bg-slate-800/70 rounded-lg p-2.5 border border-slate-700/70">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                Body Style & Flow Direction
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={bodyStyle}
                  onChange={(e) => setBodyStyle(e.target.value as BodyStyleId)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono text-slate-100"
                >
                  <option value="GLOBE_STRAIGHT">Globe (1.0x)</option>
                  <option value="ANGLE_BODY">Angle (1.12x)</option>
                </select>
                <select
                  value={flowDirection}
                  onChange={(e) => setFlowDirection(e.target.value as FlowDirectionId)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono text-cyan-300"
                >
                  <option value="FTC">FTC (Over)</option>
                  <option value="FTO">FTO (Under)</option>
                </select>
              </div>
            </div>

            {/* Stroke Mode (Standard vs Extended) */}
            <div className="bg-slate-800/70 rounded-lg p-2.5 border border-slate-700/70">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1">
                Stroke Schedule (H)
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    setUseExtendedStroke(false);
                    setCustomStrokeOverride(null);
                  }}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-mono border transition ${
                    !useExtendedStroke
                      ? 'bg-cyan-600 text-white border-cyan-500 font-semibold'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  Std ({correlatedValve.stroke_mm}mm)
                </button>
                <button
                  onClick={() => {
                    setUseExtendedStroke(true);
                    setCustomStrokeOverride(null);
                  }}
                  className={`flex-1 py-1.5 px-2 rounded text-xs font-mono border transition ${
                    useExtendedStroke
                      ? 'bg-cyan-600 text-white border-cyan-500 font-semibold'
                      : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-slate-200'
                  }`}
                >
                  Ext Stroke
                </button>
              </div>
            </div>
          </div>

          {/* LIVE CORRELATED HARDWARE KPI READOUT STRIP */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2">
              <span className="block text-[10px] font-mono text-slate-400 uppercase">
                Correlated Rated Cv / Kv
              </span>
              <span className="text-sm font-mono font-bold text-cyan-400">
                {correlatedValve.ratedCv} Cv{' '}
                <span className="text-xs text-slate-400 font-normal">
                  ({correlatedValve.ratedKv} Kv)
                </span>
              </span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2">
              <span className="block text-[10px] font-mono text-slate-400 uppercase">
                Specific Capacity Cd (Cv/d²)
              </span>
              <span className="text-sm font-mono font-bold text-slate-100">
                {correlatedValve.effectiveCd}{' '}
                <span className="text-xs text-slate-400 font-normal">Cv/in²</span>
              </span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2">
              <span className="block text-[10px] font-mono text-slate-400 uppercase">
                Seat Port Bore Ød_port
              </span>
              <span className="text-sm font-mono font-bold text-slate-100">
                {correlatedValve.d_port_mm} mm{' '}
                <span className="text-xs text-slate-400 font-normal">
                  ({correlatedValve.d_port_in}")
                </span>
              </span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2">
              <span className="block text-[10px] font-mono text-slate-400 uppercase">
                Rated Stroke H (Curtain Ratio)
              </span>
              <span className="text-sm font-mono font-bold text-slate-100">
                {correlatedValve.stroke_mm} mm{' '}
                <span className="text-xs text-cyan-400 font-normal">
                  ({correlatedValve.curtainToSeatAreaRatio}x Seat)
                </span>
              </span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2">
              <span className="block text-[10px] font-mono text-slate-400 uppercase">
                Series Cv (Trim / Seat / Body)
              </span>
              <span className="text-xs font-mono font-semibold text-slate-200">
                {correlatedValve.cvTrimComponent} / {correlatedValve.cvSeatComponent} /{' '}
                {correlatedValve.cvBodyComponent}
              </span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2">
              <span className="block text-[10px] font-mono text-slate-400 uppercase">
                Recovery Factors (FL / Kc / xT)
              </span>
              <span className="text-sm font-mono font-bold text-emerald-400">
                {correlatedValve.FL} / {correlatedValve.Kc} / {correlatedValve.xT}
              </span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2">
              <span className="block text-[10px] font-mono text-slate-400 uppercase">
                ASME Min Body Wall t_body
              </span>
              <span className="text-sm font-mono font-bold text-slate-100">
                {correlatedValve.bodyMinWall_mm} mm
              </span>
            </div>

            <div className="bg-slate-900/90 border border-slate-800 rounded-lg px-3 py-2">
              <span className="block text-[10px] font-mono text-slate-400 uppercase">
                Synthesized Cage Orifices
              </span>
              <span className="text-sm font-mono font-bold text-cyan-400">
                {cageSynthesis.totalHoles} holes{' '}
                <span className="text-xs text-slate-400 font-normal">
                  (Ø{cageSynthesis.meanHoleDia_mm}mm)
                </span>
              </span>
            </div>
          </div>

          {/* SEGMENTED WORKBENCH MODE SWITCHER */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950/90 p-1.5 rounded-xl border border-slate-800 no-print">
            {[
              {
                id: 'PROCESS_SIZING',
                label: '1. Multi-Condition Sizing & Noise (IEC 60534)',
                icon: Activity,
              },
              {
                id: 'CHARACTERISTICS',
                label: '2. Inherent, Custom & Installed Gain (Pv)',
                icon: Sliders,
              },
              {
                id: 'CAGE_CAD_STRESS',
                label: '3. Drilled Cage Synthesis, Hoop Stress & CAD/CAM',
                icon: Layers,
              },
              {
                id: 'TRANSIENT_THERMAL',
                label: '4. Transient Thermal Binding & Bonnet Advisor',
                icon: Thermometer,
              },
              {
                id: 'ACTUATOR_STEM',
                label: '5. Balanced/Unbalanced Thrust & Stem Sizing',
                icon: Wrench,
              },
              {
                id: 'MASTER_SCHEDULE',
                label: '6. Generic Valve Correlation & Master Table',
                icon: Table,
              },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as ActiveTabId)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-mono transition ${
                    isActive
                      ? 'bg-cyan-600 text-white font-semibold shadow-lg shadow-cyan-950/60'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* MAIN WORKBENCH CONTENT AREA */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6 space-y-6">
        {/* =====================================================================
            TAB 1: MULTI-CONDITION PROCESS SIZING, SWAGED PIPING & ACOUSTIC NOISE
           ===================================================================== */}
        {activeTab === 'PROCESS_SIZING' && (
          <div className="space-y-6">
            {/* AUTOMATED VALVE SIZE & PRESSURE CLASS SELECTION CARD */}
            <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-cyan-500/40 rounded-xl p-5 shadow-2xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-700/60 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      Multi-Condition Valve Sizing & Selection Analysis
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono text-[10px] font-semibold">
                        ALL CONDITIONS ACCOMMODATED IN ONE VALVE
                      </span>
                    </h2>
                    <p className="text-xs text-slate-400 font-mono">
                      Calculates actual required Cv per condition, checks pressure & temperature limits, and selects optimal standard size on Linear trim
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      handleSelectSizeFromSchedule(valveRecommendation.recommendedDN);
                      setPressureClass(valveRecommendation.recommendedPressureClass);
                      setTrimStyle('CONTOURED_LINEAR');
                      setCharConfig((prev) => ({ ...prev, type: 'LINEAR' }));
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-semibold text-xs transition shadow-lg shadow-cyan-900/40"
                  >
                    Apply Recommended Valve: DN{valveRecommendation.recommendedDN} ({valveRecommendation.recommendedNPS}) {PRESSURE_CLASSES[valveRecommendation.recommendedPressureClass].label.split('/')[0]}
                  </button>
                </div>
              </div>

              {/* Readout Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-700/80">
                  <span className="block text-[10px] font-mono text-slate-400 uppercase">Suggested Size</span>
                  <span className="text-base font-mono font-bold text-cyan-400">
                    DN{valveRecommendation.recommendedDN} ({valveRecommendation.recommendedNPS})
                  </span>
                  <span className="block text-[10px] font-mono text-slate-500">
                    Bore Ø{GENERIC_VALVE_SCHEDULE.find((s) => s.dn === valveRecommendation.recommendedDN)?.d_port_mm} mm
                  </span>
                </div>

                <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-700/80">
                  <span className="block text-[10px] font-mono text-slate-400 uppercase">Suggested Rating</span>
                  <span className="text-base font-mono font-bold text-slate-100">
                    {PRESSURE_CLASSES[valveRecommendation.recommendedPressureClass].label.split('/')[0]}
                  </span>
                  <span className="block text-[10px] font-mono text-slate-500">
                    P_max = {valveRecommendation.maxPressureBarA.toFixed(1)} bar a @ {valveRecommendation.maxTemperatureDegC}°C
                  </span>
                </div>

                <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-700/80">
                  <span className="block text-[10px] font-mono text-slate-400 uppercase">Max Required Cv (Capacity)</span>
                  <span className="text-base font-mono font-bold text-amber-400">
                    {valveRecommendation.maxRequiredCv} Cv
                  </span>
                  <span className="block text-[10px] font-mono text-slate-500">
                    Rated: {valveRecommendation.recommendedRatedCv} Cv ({valveRecommendation.maxPercentOpen}% open)
                  </span>
                </div>

                <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-700/80">
                  <span className="block text-[10px] font-mono text-slate-400 uppercase">Min Required Cv (Turndown)</span>
                  <span className="text-base font-mono font-bold text-slate-100">
                    {valveRecommendation.minRequiredCv} Cv
                  </span>
                  <span className="block text-[10px] font-mono text-emerald-400 font-semibold">
                    {valveRecommendation.minPercentOpen}% open ({valveRecommendation.turndownRatio}:1 turndown)
                  </span>
                </div>

                <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-700/80">
                  <span className="block text-[10px] font-mono text-slate-400 uppercase">Operating Travel Span</span>
                  <span className="text-base font-mono font-bold text-emerald-400">
                    {valveRecommendation.minPercentOpen}% — {valveRecommendation.maxPercentOpen}%
                  </span>
                  <span className="block text-[10px] font-mono text-slate-500">
                    Linear Trim (Ideal 15%–85%)
                  </span>
                </div>

                <div className="bg-slate-900/90 rounded-lg p-3 border border-slate-700/80">
                  <span className="block text-[10px] font-mono text-slate-400 uppercase">Max Predicted Noise</span>
                  <span className="text-base font-mono font-bold text-cyan-400">
                    {Math.max(...caseResults.map((c) => c.noiseDrilledCage_dBA))} dBA
                  </span>
                  <span className="block text-[10px] font-mono text-slate-500">
                    Std trim: {Math.max(...caseResults.map((c) => c.noiseStandardTrim_dBA))} dBA
                  </span>
                </div>
              </div>

              {/* Engineering Rationale bullet list */}
              <div className="bg-slate-950/70 rounded-lg p-3 border border-slate-800 text-xs font-mono space-y-1 text-slate-300">
                {valveRecommendation.rationale.map((r, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="text-cyan-400 font-bold">•</span>
                    <span>{r}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Top Row: Fluid Preset Loader & Piping Envelope */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Fluid Presets & Custom Dimension Overrides */}
              <div className="lg:col-span-5 bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Gauge className="w-4 h-4 text-cyan-400" />
                      Process Fluid Benchmark Presets & Hardware Overrides
                    </h2>
                    <p className="text-xs text-slate-400 font-mono">
                      Load standard fluid properties or customize bore/stroke/Cv
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1.5">
                    Quick-Load Process Fluid Preset (Applies to All Operating Cases)
                  </label>
                  <select
                    onChange={(e) => applyFluidPresetToAllCases(e.target.value)}
                    defaultValue="BFW_185C"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300"
                  >
                    {FLUID_PRESETS.map((fp) => (
                      <option key={fp.id} value={fp.id}>
                        {fp.name} — [{fp.phase}]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Custom Seat Bore (mm)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      placeholder={`${correlatedValve.d_port_mm}`}
                      value={customBoreOverride ?? ''}
                      onChange={(e) =>
                        setCustomBoreOverride(
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Custom Stroke H (mm)
                    </label>
                    <input
                      type="number"
                      step="1"
                      placeholder={`${correlatedValve.stroke_mm}`}
                      value={customStrokeOverride ?? ''}
                      onChange={(e) =>
                        setCustomStrokeOverride(
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Custom Rated Cv
                    </label>
                    <input
                      type="number"
                      step="1"
                      placeholder={`${correlatedValve.ratedCv}`}
                      value={customRatedCvOverride ?? ''}
                      onChange={(e) =>
                        setCustomRatedCvOverride(
                          e.target.value ? Number(e.target.value) : null
                        )
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
                    />
                  </div>
                </div>
              </div>

              {/* Swaged Piping & Water-Hammer Envelope */}
              <div className="lg:col-span-7 bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-100">
                      Swaged Piping Geometry (FP, FLP, xTP) & Water-Hammer Envelope
                    </h2>
                    <p className="text-xs text-slate-400 font-mono">
                      Coupled concentric reducer/expander head loss & Joukowsky acoustic reflection check
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-xs font-mono text-cyan-400">
                    Valve d = {correlatedValve.d_mm} mm vs Pipe D1/D2 = {piping.upstreamPipeID_mm}/
                    {piping.downstreamPipeID_mm} mm
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Upstream Pipe ID D1 (mm)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={piping.upstreamPipeID_mm}
                      onChange={(e) =>
                        setPiping({ ...piping, upstreamPipeID_mm: Number(e.target.value) })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Downstream Pipe D2 (mm)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={piping.downstreamPipeID_mm}
                      onChange={(e) =>
                        setPiping({ ...piping, downstreamPipeID_mm: Number(e.target.value) })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Pipe Wall t_p (mm)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={piping.pipeWallThickness_mm}
                      onChange={(e) =>
                        setPiping({ ...piping, pipeWallThickness_mm: Number(e.target.value) })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Line Length L (m)
                    </label>
                    <input
                      type="number"
                      step="5"
                      value={piping.upstreamPipeLength_m}
                      onChange={(e) =>
                        setPiping({ ...piping, upstreamPipeLength_m: Number(e.target.value) })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Fast-Close Time (s)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={piping.actuatorCloseTime_s}
                      onChange={(e) =>
                        setPiping({ ...piping, actuatorCloseTime_s: Number(e.target.value) })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-slate-400 mb-1">
                      Body Alloy Group
                    </label>
                    <select
                      value={piping.bodyMaterialCategory}
                      onChange={(e) =>
                        setPiping({
                          ...piping,
                          bodyMaterialCategory: e.target.value as
                            | 'CARBON_STEEL'
                            | 'STAINLESS_ALLOY',
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-xs font-mono text-cyan-300"
                    >
                      <option value="STAINLESS_ALLOY">SS / Cr-Mo (≤15 m/s)</option>
                      <option value="CARBON_STEEL">Carbon Steel (≤10.5 m/s)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Multi-Condition Operating Inputs Table */}
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-100">
                    Multi-Condition Process Operating Cases (Min / Normal / Max / Start-Up / Upset)
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">
                    Edit flow rates, pressures, temperatures, and fluid properties per operating point
                  </p>
                </div>
                <button
                  onClick={() =>
                    setOperatingCases((prev) => [
                      ...prev,
                      {
                        ...prev[prev.length - 1],
                        id: `case-${Date.now()}`,
                        label: `Case ${prev.length + 1}`,
                      },
                    ])
                  }
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 text-xs font-mono transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Operating Case
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 bg-slate-900/60">
                      <th className="py-2.5 px-3">Case Name</th>
                      <th className="py-2.5 px-2">Phase</th>
                      <th className="py-2.5 px-2">Flow (m³/h | Nm³/h | kg/h)</th>
                      <th className="py-2.5 px-2">P1 (bar a)</th>
                      <th className="py-2.5 px-2">P2 (bar a)</th>
                      <th className="py-2.5 px-2">T1 (°C)</th>
                      <th className="py-2.5 px-2">ρ (kg/m³) / MW</th>
                      <th className="py-2.5 px-2">Pv (bar a) / γ</th>
                      <th className="py-2.5 px-2">ν (cSt) / Z</th>
                      <th className="py-2.5 px-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {operatingCases.map((c, idx) => (
                      <tr key={c.id} className="hover:bg-slate-900/40">
                        <td className="py-2 px-3">
                          <input
                            type="text"
                            value={c.label}
                            onChange={(e) => {
                              const next = [...operatingCases];
                              next[idx].label = e.target.value;
                              setOperatingCases(next);
                            }}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-36 text-cyan-300 font-semibold"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <select
                            value={c.fluidPhase}
                            onChange={(e) => {
                              const next = [...operatingCases];
                              next[idx].fluidPhase = e.target.value as any;
                              setOperatingCases(next);
                            }}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-slate-200"
                          >
                            <option value="LIQUID">LIQUID</option>
                            <option value="GAS">GAS</option>
                            <option value="STEAM">STEAM</option>
                          </select>
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="1"
                            value={c.flowRate}
                            onChange={(e) => {
                              const next = [...operatingCases];
                              next[idx].flowRate = Number(e.target.value);
                              setOperatingCases(next);
                            }}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-24 text-slate-100"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.5"
                            value={c.P1_bar_a}
                            onChange={(e) => {
                              const next = [...operatingCases];
                              next[idx].P1_bar_a = Number(e.target.value);
                              setOperatingCases(next);
                            }}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-20 text-slate-100"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.5"
                            value={c.P2_bar_a}
                            onChange={(e) => {
                              const next = [...operatingCases];
                              next[idx].P2_bar_a = Number(e.target.value);
                              setOperatingCases(next);
                            }}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-20 text-slate-100"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="5"
                            value={c.T1_degC}
                            onChange={(e) => {
                              const next = [...operatingCases];
                              next[idx].T1_degC = Number(e.target.value);
                              setOperatingCases(next);
                            }}
                            className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-20 text-slate-100"
                          />
                        </td>
                        <td className="py-2 px-2">
                          {c.fluidPhase === 'LIQUID' ? (
                            <input
                              type="number"
                              step="10"
                              value={c.rho_kg_m3}
                              onChange={(e) => {
                                const next = [...operatingCases];
                                next[idx].rho_kg_m3 = Number(e.target.value);
                                setOperatingCases(next);
                              }}
                              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-20 text-slate-100"
                              title="Liquid Density (kg/m³)"
                            />
                          ) : (
                            <input
                              type="number"
                              step="0.5"
                              value={c.molecularWeight}
                              onChange={(e) => {
                                const next = [...operatingCases];
                                next[idx].molecularWeight = Number(e.target.value);
                                setOperatingCases(next);
                              }}
                              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-20 text-slate-100"
                              title="Molecular Weight (kg/kmol)"
                            />
                          )}
                        </td>
                        <td className="py-2 px-2">
                          {c.fluidPhase === 'LIQUID' ? (
                            <input
                              type="number"
                              step="0.1"
                              value={c.Pv_bar_a}
                              onChange={(e) => {
                                const next = [...operatingCases];
                                next[idx].Pv_bar_a = Number(e.target.value);
                                setOperatingCases(next);
                              }}
                              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-20 text-slate-100"
                              title="Vapor Pressure Pv (bar a)"
                            />
                          ) : (
                            <input
                              type="number"
                              step="0.02"
                              value={c.gammaCpCv}
                              onChange={(e) => {
                                const next = [...operatingCases];
                                next[idx].gammaCpCv = Number(e.target.value);
                                setOperatingCases(next);
                              }}
                              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-20 text-slate-100"
                              title="Specific Heat Ratio Cp/Cv"
                            />
                          )}
                        </td>
                        <td className="py-2 px-2">
                          {c.fluidPhase === 'LIQUID' ? (
                            <input
                              type="number"
                              step="0.05"
                              value={c.viscosity_cSt}
                              onChange={(e) => {
                                const next = [...operatingCases];
                                next[idx].viscosity_cSt = Number(e.target.value);
                                setOperatingCases(next);
                              }}
                              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-20 text-slate-100"
                              title="Kinematic Viscosity (cSt)"
                            />
                          ) : (
                            <input
                              type="number"
                              step="0.02"
                              value={c.compressibilityZ}
                              onChange={(e) => {
                                const next = [...operatingCases];
                                next[idx].compressibilityZ = Number(e.target.value);
                                setOperatingCases(next);
                              }}
                              className="bg-slate-900 border border-slate-700 rounded px-2 py-1 w-20 text-slate-100"
                              title="Compressibility Factor Z"
                            />
                          )}
                        </td>
                        <td className="py-2 px-2 text-right">
                          {operatingCases.length > 1 && (
                            <button
                              onClick={() =>
                                setOperatingCases(operatingCases.filter((item) => item.id !== c.id))
                              }
                              className="p-1 text-slate-500 hover:text-red-400 transition"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* IEC 60534 SIZING, CAVITATION, VELOCITY & ACOUSTIC NOISE DIAGNOSTIC MATRIX */}
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-cyan-400" />
                    IEC 60534-2-1 & 60534-8-3/8-4 Sizing, Cavitation, Velocity & Acoustic Noise Results
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">
                    Includes coupled reducer/expander factors (FP, FLP, xTP), Strouhal ultrasonic frequency shift (fp), and Joukowsky surge
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300">
                    Pipe Ring Freq f_r: <strong className="text-cyan-400">{caseResults[0]?.ringFreq_Hz || 15000} Hz</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-slate-300">
                    Mean Cage Orifice Ød_h: <strong className="text-cyan-400">{cageSynthesis.meanHoleDia_mm} mm</strong>
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 bg-slate-900/60">
                      <th className="py-2.5 px-3">Case</th>
                      <th className="py-2.5 px-2">ΔP / ΔP_choked (bar)</th>
                      <th className="py-2.5 px-2">FP / FLP</th>
                      <th className="py-2.5 px-2">Re_v (F_R)</th>
                      <th className="py-2.5 px-2">Req Cv (Kv)</th>
                      <th className="py-2.5 px-2">% Rated Cv</th>
                      <th className="py-2.5 px-2">Travel %</th>
                      <th className="py-2.5 px-2">Cavitation σ / xFZ / Kc</th>
                      <th className="py-2.5 px-2">Regime Classification</th>
                      <th className="py-2.5 px-2">Body Vel / Mach</th>
                      <th className="py-2.5 px-2">Strouhal f_p (Hz)</th>
                      <th className="py-2.5 px-2">Noise Std → Drilled (dBA)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {caseResults.map((r) => {
                      const cvOver85 = r.percentOfRatedCv > 85;
                      const cvUnder10 = r.percentOfRatedCv < 10;
                      return (
                        <tr key={r.id} className="hover:bg-slate-900/40">
                          <td className="py-3 px-3 font-bold text-slate-100">{r.label}</td>
                          <td className="py-3 px-2">
                            <span className="text-slate-100">{r.deltaP_bar}</span> /{' '}
                            <span className="text-slate-400">{r.deltaP_choked_bar}</span>
                            {r.isChoked && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-amber-950 text-amber-400 border border-amber-700 text-[10px]">
                                CHOKED
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-2 text-slate-300">
                            {r.FP} / {r.FLP}
                          </td>
                          <td className="py-3 px-2 text-slate-300">
                            {r.Rev.toLocaleString()} ({r.FR})
                          </td>
                          <td className="py-3 px-2 font-bold text-cyan-400">
                            {r.requiredCv} <span className="text-slate-400 font-normal">({r.requiredKv})</span>
                          </td>
                          <td className="py-3 px-2">
                            <span
                              className={`font-bold ${
                                cvOver85
                                  ? 'text-red-400'
                                  : cvUnder10
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }`}
                            >
                              {r.percentOfRatedCv}%
                            </span>
                          </td>
                          <td className="py-3 px-2 font-semibold text-slate-200">
                            {r.estimatedTravelPct}%
                          </td>
                          <td className="py-3 px-2 text-slate-300">
                            {r.fluidPhase === 'LIQUID'
                              ? `σ=${r.sigmaCavitation} | ${r.xFZ} | ${r.Kc_effective}`
                              : `xTP=${r.xTP}`}
                          </td>
                          <td className="py-3 px-2">
                            {renderStatusBadge(r.regimeSeverity, r.regimeLabel)}
                          </td>
                          <td className="py-3 px-2">
                            <span
                              className={
                                r.bodyVelocity_m_s > r.bodyVelocityLimit_m_s ||
                                r.outletMach > r.outletMachLimit
                                  ? 'text-red-400 font-bold'
                                  : 'text-slate-200'
                              }
                            >
                              {r.bodyVelocity_m_s} m/s (M={r.outletMach})
                            </span>
                          </td>
                          <td className="py-3 px-2 text-cyan-300">
                            {r.strouhalPeakFreq_Hz.toLocaleString()} Hz
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 line-through">
                                {r.noiseStandardTrim_dBA}
                              </span>
                              <span className="text-slate-500">→</span>
                              <span
                                className={`font-bold ${
                                  r.noiseStatus === 'PASS'
                                    ? 'text-emerald-400'
                                    : r.noiseStatus === 'WARNING'
                                    ? 'text-amber-400'
                                    : 'text-red-400'
                                }`}
                              >
                                {r.noiseDrilledCage_dBA} dBA
                              </span>
                              <span className="text-[10px] text-cyan-400">
                                (-{r.noiseAttenuation_dBA} dB)
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Water-Hammer & Flashing Advisory Footnote */}
              {caseResults.some((r) => r.fluidPhase === 'LIQUID') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 text-xs font-mono">
                    <span className="text-slate-400 block uppercase text-[10px] mb-1">
                      Joukowsky Water-Hammer Fast-Close Surge Check (Skousen Ch. 9)
                    </span>
                    <p className="text-slate-200">
                      Peak Fast-Close Pressure Surge:{' '}
                      <strong className="text-amber-400">
                        +{Math.max(...caseResults.map((c) => c.joukowskySurge_bar))} bar
                      </strong>{' '}
                      at t_close = {piping.actuatorCloseTime_s}s. Recommended minimum stroke time to eliminate reflection wave overlap:{' '}
                      <strong className="text-cyan-400">
                        ≥ {caseResults[0]?.minSafeCloseTime_s} s
                      </strong>
                      .
                    </p>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-3.5 text-xs font-mono">
                    <span className="text-slate-400 block uppercase text-[10px] mb-1">
                      IEC 60534-8-3 Ultrasonic Frequency Shift Mechanism
                    </span>
                    <p className="text-slate-200">
                      Dividing total flow area into{' '}
                      <strong className="text-cyan-400">{cageSynthesis.totalHoles} drilled orifices</strong>{' '}
                      (Ø{cageSynthesis.meanHoleDia_mm} mm) shifts the Strouhal peak frequency to{' '}
                      <strong className="text-cyan-400">
                        {caseResults[0]?.strouhalPeakFreq_Hz.toLocaleString()} Hz
                      </strong>
                      , maximizing pipe-wall transmission loss and reducing external noise by up to{' '}
                      <strong className="text-emerald-400">
                        {Math.max(...caseResults.map((c) => c.noiseAttenuation_dBA))} dBA
                      </strong>
                      .
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 2: INHERENT, CUSTOM & INSTALLED FLOW CHARACTERISTICS (Pv & GAIN)
           ===================================================================== */}
        {activeTab === 'CHARACTERISTICS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Controls: Characteristic Selector, Authority Pv & Custom Spline Editor */}
            <div className="lg:col-span-4 bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-5">
              <div className="border-b border-slate-700/60 pb-3">
                <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-cyan-400" />
                  Inherent & Custom Trim Characteristic Builder
                </h2>
                <p className="text-xs text-slate-400 font-mono">
                  Configure inherent curve φ(h) and piping Valve Authority Pv
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-mono text-slate-300 mb-1">
                    Trim Flow Characteristic Law
                  </label>
                  <select
                    value={charConfig.type}
                    onChange={(e) =>
                      setCharConfig({
                        ...charConfig,
                        type: e.target.value as CharacteristicTypeId,
                      })
                    }
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300"
                  >
                    <option value="EQUAL_PCT">Equal-Percentage (Standard R^((h-1)))</option>
                    <option value="LINEAR">Linear (φ = h)</option>
                    <option value="MODIFIED_EQUAL_PCT">Modified Equal-% / Parabolic High-Lift</option>
                    <option value="BI_LINEAR">Bi-Linear / Dual-Slope (Low-Lift Trickle + Main)</option>
                    <option value="QUICK_OPENING">Quick-Opening (φ = h^0.45)</option>
                    <option value="MODIFIED_PARABOLIC">Modified Parabolic (φ = h^1.75)</option>
                    <option value="CUSTOM_SPLINE">Custom Multi-Point PCHIP Spline Table</option>
                    <option value="AUTO_FIT_CONSTANT_GAIN">
                      Auto-Fit Constant Installed Gain (G_inst = 1.0 at Pv)
                    </option>
                  </select>
                </div>

                {/* Valve Authority Pv Slider */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-xs font-mono">
                    <span className="text-slate-300">
                      Valve Authority P_v = ΔP_valve(100%) / ΔP_system
                    </span>
                    <span className="text-cyan-400 font-bold">
                      {charConfig.valveAuthorityPv.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.95"
                    step="0.01"
                    value={charConfig.valveAuthorityPv}
                    onChange={(e) =>
                      setCharConfig({
                        ...charConfig,
                        valveAuthorityPv: Number(e.target.value),
                      })
                    }
                    className="w-full accent-cyan-500"
                  />
                  <p className="text-[11px] font-mono text-slate-400">
                    Low Pv (&lt;0.30) indicates high frictional piping loss at max flow, flattening Linear trims.
                  </p>
                </div>

                {/* Equal-% Rangeability R */}
                {(charConfig.type === 'EQUAL_PCT' ||
                  charConfig.type === 'MODIFIED_EQUAL_PCT') && (
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">
                      Inherent Rangeability R (30:1 / 50:1 / 100:1)
                    </label>
                    <input
                      type="number"
                      step="5"
                      value={charConfig.equalPctRangeability}
                      onChange={(e) =>
                        setCharConfig({
                          ...charConfig,
                          equalPctRangeability: Number(e.target.value),
                        })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-1.5 text-xs font-mono text-slate-100"
                    />
                  </div>
                )}

                {/* Bi-Linear Knee Point */}
                {charConfig.type === 'BI_LINEAR' && (
                  <div className="grid grid-cols-2 gap-3 bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">
                        Knee Travel %
                      </label>
                      <input
                        type="number"
                        value={charConfig.biLinearKneeTravelPct}
                        onChange={(e) =>
                          setCharConfig({
                            ...charConfig,
                            biLinearKneeTravelPct: Number(e.target.value),
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-cyan-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">
                        Knee Cv %
                      </label>
                      <input
                        type="number"
                        value={charConfig.biLinearKneeCvPct}
                        onChange={(e) =>
                          setCharConfig({
                            ...charConfig,
                            biLinearKneeCvPct: Number(e.target.value),
                          })
                        }
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs font-mono text-cyan-300"
                      />
                    </div>
                  </div>
                )}

                {/* Custom Multi-Point PCHIP Spline Editor */}
                {charConfig.type === 'CUSTOM_SPLINE' && (
                  <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-semibold text-cyan-400">
                        Custom PCHIP Control Points (Travel % → Cv %)
                      </span>
                      <button
                        onClick={() =>
                          setCharConfig({
                            ...charConfig,
                            customPoints: [
                              ...charConfig.customPoints,
                              { travelPct: 50, cvPct: 25 },
                            ].sort((a, b) => a.travelPct - b.travelPct),
                          })
                        }
                        className="px-2 py-0.5 rounded bg-cyan-600/20 text-cyan-300 border border-cyan-500/40 text-[11px] font-mono"
                      >
                        + Point
                      </button>
                    </div>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {charConfig.customPoints.map((pt, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs font-mono">
                          <span className="text-slate-500 w-6">#{i + 1}</span>
                          <input
                            type="number"
                            value={pt.travelPct}
                            onChange={(e) => {
                              const next = [...charConfig.customPoints];
                              next[i].travelPct = Number(e.target.value);
                              setCharConfig({ ...charConfig, customPoints: next });
                            }}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-20 text-slate-200"
                          />
                          <span className="text-slate-500">% →</span>
                          <input
                            type="number"
                            value={pt.cvPct}
                            onChange={(e) => {
                              const next = [...charConfig.customPoints];
                              next[i].cvPct = Number(e.target.value);
                              setCharConfig({ ...charConfig, customPoints: next });
                            }}
                            className="bg-slate-950 border border-slate-700 rounded px-2 py-1 w-20 text-cyan-300"
                          />
                          <span className="text-slate-500">% Cv</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Loop Gain & EnTec Stability Diagnostic Summary */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono text-slate-400 uppercase">
                    EnTec [0.5, 2.0] Gain Stability Coverage
                  </span>
                  {renderStatusBadge(
                    charSimulation.stabilityBandCoveragePct >= 80
                      ? 'PASS'
                      : charSimulation.stabilityBandCoveragePct >= 55
                      ? 'WARNING'
                      : 'CRITICAL',
                    `${charSimulation.stabilityBandCoveragePct}% IN BAND`
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center font-mono">
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="block text-[10px] text-slate-400">Min Gain (15-85%)</span>
                    <span className="text-sm font-bold text-slate-100">
                      {charSimulation.minInstalledGainWorkingSpan}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="block text-[10px] text-slate-400">Max Gain (15-85%)</span>
                    <span className="text-sm font-bold text-slate-100">
                      {charSimulation.maxInstalledGainWorkingSpan}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800">
                    <span className="block text-[10px] text-slate-400">Gain Ratio</span>
                    <span className="text-sm font-bold text-cyan-400">
                      {charSimulation.gainRatioWorkingSpan}:1
                    </span>
                  </div>
                </div>
                <p className="text-xs font-mono text-slate-300 leading-relaxed">
                  {charSimulation.recommendedCharacteristicNote}
                </p>
              </div>
            </div>

            {/* Right Dual SVG Charts: (1) Inherent vs Installed Flow, (2) Installed Gain Curve */}
            <div className="lg:col-span-8 space-y-6">
              {/* Chart 1: Inherent Cv % vs Installed Flow % + Operating Case Markers */}
              <div className="bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      Inherent Capacity φ(h) vs. Installed Loop Flow Q(h)/Q_max (at Pv ={' '}
                      {charConfig.valveAuthorityPv.toFixed(2)})
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Cyan = Inherent Trim Curve | Emerald = Installed Loop Flow | Amber Dots = Active Process Operating Cases
                    </p>
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <svg viewBox="0 0 680 280" className="w-full h-64 overflow-visible">
                    {/* Grid lines */}
                    {[0, 20, 40, 60, 80, 100].map((tick) => {
                      const x = 50 + (tick / 100) * 590;
                      const y = 245 - (tick / 100) * 215;
                      return (
                        <g key={tick}>
                          <line
                            x1={x}
                            y1={30}
                            x2={x}
                            y2={245}
                            stroke="#1e293b"
                            strokeDasharray="3 3"
                          />
                          <line
                            x1={50}
                            y1={y}
                            x2={640}
                            y2={y}
                            stroke="#1e293b"
                            strokeDasharray="3 3"
                          />
                          <text
                            x={x}
                            y={264}
                            textAnchor="middle"
                            className="fill-slate-400 text-[10px] font-mono"
                          >
                            {tick}%
                          </text>
                          <text
                            x={40}
                            y={y + 3}
                            textAnchor="end"
                            className="fill-slate-400 text-[10px] font-mono"
                          >
                            {tick}%
                          </text>
                        </g>
                      );
                    })}

                    {/* Diagonal Ideal Linear Reference */}
                    <line
                      x1={50}
                      y1={245}
                      x2={640}
                      y2={30}
                      stroke="#334155"
                      strokeDasharray="5 5"
                      strokeWidth="1.2"
                    />

                    {/* Inherent Curve Polyline (Cyan) */}
                    <polyline
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2.5"
                      points={charSimulation.points
                        .map(
                          (p) =>
                            `${50 + (p.travelPct / 100) * 590},${
                              245 - p.inherentPhi * 215
                            }`
                        )
                        .join(' ')}
                    />

                    {/* Installed Flow Curve Polyline (Emerald) */}
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      points={charSimulation.points
                        .map(
                          (p) =>
                            `${50 + (p.travelPct / 100) * 590},${
                              245 - (p.installedFlowPct / 100) * 215
                            }`
                        )
                        .join(' ')}
                    />

                    {/* Plot Operating Cases on the Inherent Curve */}
                    {caseResults.map((c) => {
                      const cx = 50 + (Math.min(100, c.estimatedTravelPct) / 100) * 590;
                      const cy = 245 - (Math.min(100, c.percentOfRatedCv) / 100) * 215;
                      return (
                        <g key={c.id}>
                          <circle
                            cx={cx}
                            cy={cy}
                            r="5.5"
                            className="fill-amber-400 stroke-slate-950"
                            strokeWidth="2"
                          />
                          <text
                            x={cx + 8}
                            y={cy - 6}
                            className="fill-amber-300 text-[10px] font-mono font-bold"
                          >
                            {c.label} ({c.estimatedTravelPct}%)
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Chart 2: Installed Gain G_installed(h) vs EnTec [0.5, 2.0] Stability Band */}
              <div className="bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Installed Loop Gain G_installed(h) & EnTec [0.5, 2.0] Stability Envelope
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Shaded Emerald Zone = Target [0.5, 2.0] Gain Stability Band across 15%–85% Working Travel
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  <svg viewBox="0 0 680 240" className="w-full h-56 overflow-visible">
                    {/* EnTec [0.5, 2.0] Stability Band Shaded Rectangle (Max Y = 3.0) */}
                    {(() => {
                      const yGain20 = 205 - (2.0 / 3.0) * 180;
                      const yGain05 = 205 - (0.5 / 3.0) * 180;
                      const x15 = 50 + 0.15 * 590;
                      const x85 = 50 + 0.85 * 590;
                      return (
                        <rect
                          x={x15}
                          y={yGain20}
                          width={x85 - x15}
                          height={yGain05 - yGain20}
                          fill="#10b981"
                          fillOpacity="0.12"
                          stroke="#10b981"
                          strokeOpacity="0.4"
                          strokeDasharray="4 4"
                        />
                      );
                    })()}

                    {[0, 0.5, 1.0, 1.5, 2.0, 2.5, 3.0].map((gTick) => {
                      const y = 205 - (gTick / 3.0) * 180;
                      return (
                        <g key={gTick}>
                          <line
                            x1={50}
                            y1={y}
                            x2={640}
                            y2={y}
                            stroke={gTick === 1.0 ? '#06b6d4' : '#1e293b'}
                            strokeDasharray={gTick === 1.0 ? '6 3' : '3 3'}
                          />
                          <text
                            x={42}
                            y={y + 3}
                            textAnchor="end"
                            className="fill-slate-400 text-[10px] font-mono"
                          >
                            {gTick.toFixed(1)}
                          </text>
                        </g>
                      );
                    })}

                    {/* Inherent Gain Curve (Dashed Cyan) */}
                    <polyline
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="1.8"
                      strokeDasharray="4 4"
                      points={charSimulation.points
                        .map((p) => {
                          const x = 50 + (p.travelPct / 100) * 590;
                          const y = 205 - (Math.min(3.0, p.inherentGain) / 3.0) * 180;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />

                    {/* Installed Gain Curve (Solid Emerald) */}
                    <polyline
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.6"
                      points={charSimulation.points
                        .map((p) => {
                          const x = 50 + (p.travelPct / 100) * 590;
                          const y = 205 - (Math.min(3.0, p.installedGain) / 3.0) * 180;
                          return `${x},${y}`;
                        })
                        .join(' ')}
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 3: DRILLED CAGE SYNTHESIS, HOOP STRESS & 2D UNROLLED CAD / CAM
           ===================================================================== */}
        {activeTab === 'CAGE_CAD_STRESS' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Cage Synthesis & ASME Hoop Stress Controls */}
              <div className="lg:col-span-4 bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                  <div>
                    <h2 className="text-sm font-bold text-slate-100">
                      Drilled Cage Synthesis & Structural Stress Inputs
                    </h2>
                    <p className="text-xs text-slate-400 font-mono">
                      ASME B16.34 / Sec VIII Div. 1 Perforated Sleeve Solver
                    </p>
                  </div>
                  {renderStatusBadge(cageSynthesis.structuralStatus)}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-mono text-slate-300 mb-1">
                      Cage / Sleeve Alloy (ASME / NACE MR0175)
                    </label>
                    <select
                      value={cageMaterial}
                      onChange={(e) => setCageMaterial(e.target.value as CageMaterialId)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono text-cyan-300"
                    >
                      {Object.values(CAGE_MATERIALS).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} (Sm={m.Sm_20C_MPa} MPa | {m.hardnessHRC})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">
                        Axial Hole Rows N_rows
                      </label>
                      <input
                        type="number"
                        min="4"
                        max="30"
                        value={numRows}
                        onChange={(e) => setNumRows(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">
                        Base Orifice Ød_h (mm)
                      </label>
                      <input
                        type="number"
                        step="0.2"
                        min="1.5"
                        max="16"
                        value={baseHoleDia_mm}
                        onChange={(e) => setBaseHoleDia_mm(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-cyan-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">
                        Cage Wall t_cage (mm)
                      </label>
                      <input
                        type="number"
                        step="0.5"
                        min="2.5"
                        value={selectedWallThickness_mm}
                        onChange={(e) => setSelectedWallThickness_mm(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-400 mb-1">
                        Erosion Allowance (mm)
                      </label>
                      <input
                        type="number"
                        step="0.25"
                        min="0"
                        value={erosionAllowance_mm}
                        onChange={(e) => setErosionAllowance_mm(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-xs font-mono text-slate-100"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex items-center gap-2 text-xs font-mono text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={modulateHoleDiameter}
                        onChange={(e) => setModulateHoleDiameter(e.target.checked)}
                        className="accent-cyan-500"
                      />
                      Graduated Low-Lift Hole Ø Modulation
                    </label>
                    <label className="flex items-center gap-2 text-xs font-mono text-amber-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={requireNaceSourService}
                        onChange={(e) => setRequireNaceSourService(e.target.checked)}
                        className="accent-amber-500"
                      />
                      NACE MR0175 Sour
                    </label>
                  </div>

                  {/* ZERO-DEADBAND OVERLAPPING ROW & SIBANDA (2022) GALLERY PHYSICS CONTROLS */}
                  <div className="bg-slate-900/90 border border-cyan-500/30 rounded-lg p-3 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-mono font-semibold text-cyan-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={enforceZeroDeadbandOverlap}
                          onChange={(e) => setEnforceZeroDeadbandOverlap(e.target.checked)}
                          className="accent-cyan-500"
                        />
                        Zero-Deadband Axial Row Overlap (p_z &lt; d_h)
                      </label>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          cageSynthesis.deadbandStrokePct <= 0.1
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-700'
                            : 'bg-red-950 text-red-400 border border-red-700'
                        }`}
                      >
                        DEADBAND: {cageSynthesis.deadbandStrokePct}%
                      </span>
                    </div>

                    <div>
                      <div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
                        <span>Target Axial Row Overlap λ_overlap</span>
                        <span className="text-cyan-400 font-bold">
                          {targetRowOverlapPct}% (Actual: {cageSynthesis.meanRowOverlapPct}% |{' '}
                          {cageSynthesis.rows.length} Staggered Rows)
                        </span>
                      </div>
                      <input
                        type="range"
                        min="15"
                        max="45"
                        step="1"
                        disabled={!enforceZeroDeadbandOverlap}
                        value={targetRowOverlapPct}
                        onChange={(e) => setTargetRowOverlapPct(Number(e.target.value))}
                        className="w-full accent-cyan-500"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-[11px] font-mono text-slate-300 cursor-pointer pt-0.5">
                      <input
                        type="checkbox"
                        checked={showSibandaGalleryHeatmap}
                        onChange={(e) => setShowSibandaGalleryHeatmap(e.target.checked)}
                        className="accent-cyan-500"
                      />
                      Sibanda (2022) Eq. 5.10 3D Gallery Local Cv(θ, z) &amp; Separation Overlay
                    </label>
                  </div>
                </div>

                {/* Structural Stress & Ligament Verification Readout */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 space-y-2.5 font-mono text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Cage ID / OD:</span>
                    <span className="text-slate-100 font-semibold">
                      Ø{cageSynthesis.cageID_mm} mm / Ø{cageSynthesis.cageOD_mm} mm
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Zero-Deadband Continuity:</span>
                    <span
                      className={
                        cageSynthesis.deadbandStrokePct === 0
                          ? 'text-emerald-400 font-bold'
                          : 'text-amber-400 font-bold'
                      }
                    >
                      {cageSynthesis.deadbandStrokePct === 0
                        ? `Continuous dA/dh > 0 (Overlap ${cageSynthesis.meanRowOverlapPct}%)`
                        : `Deadband ${cageSynthesis.deadbandStrokePct}% (Max Gap ${cageSynthesis.maxDeadbandGap_mm} mm)`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Circular-Segment Curve-Fit RMS:</span>
                    <span className="text-cyan-400 font-semibold">
                      {cageSynthesis.curveFitRMSDeviationPct}% RMS Error
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Min Required Cage Wall t_min:</span>
                    <span
                      className={
                        cageSynthesis.selectedWallThickness_mm >=
                        cageSynthesis.minRequiredWallThickness_mm
                          ? 'text-emerald-400 font-bold'
                          : 'text-red-400 font-bold'
                      }
                    >
                      {cageSynthesis.minRequiredWallThickness_mm} mm (Selected:{' '}
                      {cageSynthesis.selectedWallThickness_mm} mm)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Perforated Hoop Stress σ_hoop:</span>
                    <span
                      className={
                        cageSynthesis.hoopStress_MPa <= cageSynthesis.allowableStressSm_MPa
                          ? 'text-emerald-400 font-bold'
                          : 'text-red-400 font-bold'
                      }
                    >
                      {cageSynthesis.hoopStress_MPa} MPa / {cageSynthesis.allowableStressSm_MPa} MPa (
                      {cageSynthesis.hoopStressUtilizationPct}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Buckling Collapse Pressure:</span>
                    <span className="text-cyan-400 font-semibold">
                      {cageSynthesis.criticalCollapsePressure_bar} bar (SF ={' '}
                      {cageSynthesis.collapseSafetyFactor}x)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Min Ligament Width / Efficiency:</span>
                    <span
                      className={
                        cageSynthesis.minLigamentWidth_mm >= 1.5
                          ? 'text-emerald-400'
                          : 'text-red-400 font-bold'
                      }
                    >
                      {cageSynthesis.minLigamentWidth_mm} mm (η ={' '}
                      {(cageSynthesis.minLigamentEfficiency * 100).toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">IEC 60534-8-3 Pitch/Dia (≥2.0):</span>
                    <span
                      className={
                        cageSynthesis.jetCoalescenceCompliant
                          ? 'text-emerald-400'
                          : 'text-amber-400'
                      }
                    >
                      {cageSynthesis.minPitchToDiaRatio}x (
                      {cageSynthesis.jetCoalescenceCompliant ? 'Anti-Coalescence OK' : 'Tight Pitch'})
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive 2D Unrolled Cage CAD Blueprint + Live Plug Travel Slider */}
              <div className="lg:col-span-8 bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-slate-100">
                      2D Unrolled Cylindrical Cage Perforation Blueprint (Circumference π·D_ID ={' '}
                      {(Math.PI * cageSynthesis.cageID_mm).toFixed(1)} mm × Stroke H ={' '}
                      {correlatedValve.stroke_mm} mm)
                    </h2>
                    <p className="text-xs text-slate-400 font-mono">
                      Overlapping Staggered Rows (p_z &lt; d_h) eliminate axial deadband | Sibanda (2022) 3D Gallery Local Cv(θ, z) Heatmap
                    </p>
                  </div>

                  {/* Live Plug Travel Curtain Slider */}
                  <div className="flex items-center gap-3 bg-slate-900 px-3.5 py-2 rounded-lg border border-slate-700">
                    <span className="text-xs font-mono text-slate-300">
                      Live Plug Lift: <strong className="text-cyan-400">{livePlugTravelPct}%</strong>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={livePlugTravelPct}
                      onChange={(e) => setLivePlugTravelPct(Number(e.target.value))}
                      className="w-32 accent-cyan-500"
                    />
                  </div>
                </div>

                {/* Blueprint CAD Viewport (#020617 / bg-slate-950) */}
                <div className="bg-[#020617] border border-slate-800 rounded-xl p-4 relative overflow-hidden">
                  {(() => {
                    const circum = Math.PI * cageSynthesis.cageID_mm;
                    const maxZ = correlatedValve.stroke_mm * 1.05;
                    const svgW = 760;
                    const svgH = 330;
                    const padL = 62;
                    const padR = 25;
                    const padT = 28;
                    const padB = 38;
                    const plotW = svgW - padL - padR;
                    const plotH = svgH - padT - padB;
                    const plugZ_mm = (livePlugTravelPct / 100) * correlatedValve.stroke_mm;
                    const plugY = padT + plotH - (plugZ_mm / maxZ) * plotH;

                    return (
                      <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-80">
                        {/* Sibanda (2022) 3D Gallery Flank Boundary-Layer Separation / Cavitation Risk Zones (135° & 225°) */}
                        {showSibandaGalleryHeatmap && (
                          <g>
                            {[135, 225].map((sepDeg) => {
                              const xCenter = padL + (sepDeg / 360) * plotW;
                              const bandW = (28 / 360) * plotW;
                              return (
                                <g key={sepDeg}>
                                  <rect
                                    x={xCenter - bandW / 2}
                                    y={padT}
                                    width={bandW}
                                    height={plotH}
                                    fill="#f59e0b"
                                    fillOpacity="0.06"
                                  />
                                  <text
                                    x={xCenter}
                                    y={padT - 8}
                                    textAnchor="middle"
                                    className="fill-amber-400/80 text-[8.5px] font-mono"
                                  >
                                    {sepDeg}° VORTEX / MIN Cv
                                  </text>
                                </g>
                              );
                            })}
                            <text
                              x={padL + 4}
                              y={padT - 8}
                              textAnchor="start"
                              className="fill-emerald-400/90 text-[8.5px] font-mono"
                            >
                              0° INLET STAGNATION PEAK
                            </text>
                            <text
                              x={padL + 0.5 * plotW}
                              y={padT - 8}
                              textAnchor="middle"
                              className="fill-cyan-400/90 text-[8.5px] font-mono"
                            >
                              180° REAR COLLISION RECOVERY
                            </text>
                          </g>
                        )}

                        {/* CAD Grid Lines */}
                        {[0, 45, 90, 135, 180, 225, 270, 315, 360].map((deg) => {
                          const x = padL + (deg / 360) * plotW;
                          return (
                            <g key={deg}>
                              <line
                                x1={x}
                                y1={padT}
                                x2={x}
                                y2={padT + plotH}
                                stroke="#0f172a"
                                strokeWidth="1"
                              />
                              <text
                                x={x}
                                y={svgH - 10}
                                textAnchor="middle"
                                className="fill-slate-500 text-[9.5px] font-mono"
                              >
                                {deg}° ({((deg / 360) * circum).toFixed(0)}mm)
                              </text>
                            </g>
                          );
                        })}

                        {/* Seat Line at Z = 0 mm (Row 1 bottom edge tangent to seat -> Zero initial deadband) */}
                        <line
                          x1={padL}
                          y1={padT + plotH}
                          x2={padL + plotW}
                          y2={padT + plotH}
                          stroke="#10b981"
                          strokeWidth="1.5"
                        />

                        {/* Plug Masked Curtain Overlay */}
                        <rect
                          x={padL}
                          y={padT}
                          width={plotW}
                          height={Math.max(0, plugY - padT)}
                          fill="#1e293b"
                          fillOpacity="0.38"
                        />

                        {/* Drilled Orifice Rows (True vertical hole span [zBottom_mm .. zTop_mm] showing axial row overlap) */}
                        {cageSynthesis.rows.map((row) => {
                          const cy = padT + plotH - (row.zElevation_mm / maxZ) * plotH;
                          // True vertical radius in SVG pixels so adjacent rows visually overlap when p_z < d_h
                          const ryPx = Math.max(
                            3.5,
                            ((row.holeDia_mm * 0.5) / maxZ) * plotH
                          );
                          const rxPx = Math.max(
                            3.5,
                            Math.min(12, ((row.holeDia_mm * 0.5) / circum) * plotW * 1.15)
                          );

                          // Circular-segment open fraction of this row at plugZ_mm
                          const openFrac =
                            plugZ_mm <= row.zBottom_mm
                              ? 0
                              : plugZ_mm >= row.zTop_mm
                              ? 1
                              : (plugZ_mm - row.zBottom_mm) / Math.max(0.1, row.holeDia_mm);

                          return (
                            <g key={row.rowIndex}>
                              {/* Subtle horizontal band showing [zBottom .. zTop] overlap */}
                              <line
                                x1={padL}
                                y1={cy}
                                x2={padL + plotW}
                                y2={cy}
                                stroke="#0f172a"
                                strokeDasharray="2 4"
                              />
                              <text
                                x={padL - 6}
                                y={cy + 3}
                                textAnchor="end"
                                className="fill-slate-400 text-[8.5px] font-mono"
                              >
                                R{row.rowIndex} ({row.zElevation_mm}mm)
                              </text>
                              {Array.from({ length: row.holeCount }).map((_, j) => {
                                const deg =
                                  (row.angularOffset_deg + (j * 360) / row.holeCount) % 360;
                                const cx = padL + (deg / 360) * plotW;

                                // Sibanda (2022) Eq. 5.10 Local Hole Cv factor around circumference
                                const sibanda = evaluateSibandaLocalHoleFactor({
                                  angle_deg: deg,
                                  zElevation_mm: row.zElevation_mm,
                                  stroke_mm: correlatedValve.stroke_mm,
                                  holeDia_mm: row.holeDia_mm,
                                  cageID_mm: cageSynthesis.cageID_mm,
                                });

                                let strokeColor = '#334155';
                                let fillColor = '#0f172a';
                                if (openFrac > 0) {
                                  if (showSibandaGalleryHeatmap) {
                                    if (sibanda.relativeWeight >= 1.04) {
                                      strokeColor = '#10b981'; // High local Cv (inlet stagnation / upper row)
                                      fillColor =
                                        openFrac < 1
                                          ? 'rgba(16, 185, 129, 0.20)'
                                          : 'rgba(16, 185, 129, 0.35)';
                                    } else if (sibanda.relativeWeight <= 0.9) {
                                      strokeColor = '#f59e0b'; // Flank boundary-layer separation trough (135° / 225°)
                                      fillColor =
                                        openFrac < 1
                                          ? 'rgba(245, 158, 11, 0.20)'
                                          : 'rgba(245, 158, 11, 0.34)';
                                    } else {
                                      strokeColor = '#22d3ee';
                                      fillColor =
                                        openFrac < 1
                                          ? 'rgba(6, 182, 212, 0.18)'
                                          : 'rgba(6, 182, 212, 0.32)';
                                    }
                                  } else {
                                    strokeColor = openFrac < 1 ? '#f59e0b' : '#22d3ee';
                                    fillColor =
                                      openFrac < 1
                                        ? 'rgba(245, 158, 11, 0.22)'
                                        : 'rgba(6, 182, 212, 0.28)';
                                  }
                                }

                                return (
                                  <g key={j}>
                                    <ellipse
                                      cx={cx}
                                      cy={cy}
                                      rx={rxPx}
                                      ry={ryPx}
                                      fill={fillColor}
                                      stroke={strokeColor}
                                      strokeWidth={openFrac > 0 ? '1.6' : '1'}
                                    />
                                  </g>
                                );
                              })}
                            </g>
                          );
                        })}

                        {/* Plug Metering Edge Line */}
                        <line
                          x1={padL}
                          y1={plugY}
                          x2={padL + plotW}
                          y2={plugY}
                          stroke="#f59e0b"
                          strokeWidth="2.2"
                          strokeDasharray="6 4"
                        />
                        <text
                          x={padL + plotW - 6}
                          y={Math.max(padT + 12, plugY - 6)}
                          textAnchor="end"
                          className="fill-amber-400 text-[10px] font-mono font-bold"
                        >
                          PLUG METERING EDGE (Z = {plugZ_mm.toFixed(1)} mm)
                        </text>
                      </svg>
                    );
                  })()}
                </div>

                {/* Legend for Zero-Deadband & Sibanda (2022) 3D Gallery Physics */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] font-mono">
                  <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
                    <span className="text-emerald-400 font-bold block">
                      1. Zero Initial &amp; Inter-Row Deadband
                    </span>
                    <span className="text-slate-400">
                      Row 1 bottom tangent to Z=0.0mm; adjacent staggered rows overlap vertically by{' '}
                      {cageSynthesis.meanRowOverlapPct}% (p_z &lt; d_h) so dA/dh &gt; 0 everywhere.
                    </span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
                    <span className="text-cyan-400 font-bold block">
                      2. Sibanda (2022) Eq. 5.10 Gallery Flow
                    </span>
                    <span className="text-slate-400">
                      Cv_hole = A·Re^a·D^b·HT^c·θ̄^d (R²=0.947): Peak Cv at 0° inlet stagnation &amp; upper rows (HT^0.150).
                    </span>
                  </div>
                  <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-2.5">
                    <span className="text-amber-400 font-bold block">
                      3. Flank Separation Zones (135° &amp; 225°)
                    </span>
                    <span className="text-slate-400">
                      Boundary-layer separation at θ ≈ 135° &amp; 225° reduces local hole ΔP and Cv, concentrating cavitation risk.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Row: Continuous Circular-Segment Uncovering Curve (Zero-Deadband Proof) & Sibanda 360° Angular Cv Profile */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Chart A: Continuous Circular-Segment Uncovering Cv(h) vs Target + Instantaneous Chord Gain dA/dh */}
              <div className="lg:col-span-7 bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      Continuous Circular-Segment Uncovering Curve Cv(h) &amp; Chord Width Gain dA/dh
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Cyan = Synthesized Circular-Segment Trim Cv(h) | Dashed Slate = Target Curve | Emerald = Instantaneous Chord Width dA/dh (mm²/mm)
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-700 text-xs font-mono font-bold">
                    Deadband: {cageSynthesis.deadbandStrokePct}% | RMS Dev: {cageSynthesis.curveFitRMSDeviationPct}%
                  </span>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  {(() => {
                    const maxGain = Math.max(
                      1,
                      ...cageSynthesis.continuousProfile.map((p) => p.instantaneousChordGain_mm2_per_mm)
                    );
                    const maxCvPlot = Math.max(
                      1,
                      cageSynthesis.compositeRatedCv,
                      ...cageSynthesis.continuousProfile.map((p) => p.targetCv)
                    );
                    return (
                      <svg viewBox="0 0 680 230" className="w-full h-52 overflow-visible">
                        {[0, 20, 40, 60, 80, 100].map((tick) => {
                          const x = 50 + (tick / 100) * 590;
                          const y = 195 - (tick / 100) * 165;
                          return (
                            <g key={tick}>
                              <line
                                x1={x}
                                y1={30}
                                x2={x}
                                y2={195}
                                stroke="#1e293b"
                                strokeDasharray="3 3"
                              />
                              <line
                                x1={50}
                                y1={y}
                                x2={640}
                                y2={y}
                                stroke="#1e293b"
                                strokeDasharray="3 3"
                              />
                              <text
                                x={x}
                                y={214}
                                textAnchor="middle"
                                className="fill-slate-400 text-[10px] font-mono"
                              >
                                {tick}%
                              </text>
                              <text
                                x={42}
                                y={y + 3}
                                textAnchor="end"
                                className="fill-slate-400 text-[10px] font-mono"
                              >
                                {((tick / 100) * maxCvPlot).toFixed(0)}
                              </text>
                            </g>
                          );
                        })}

                        {/* Target Valve Cv Curve (Dashed Slate) */}
                        <polyline
                          fill="none"
                          stroke="#94a3b8"
                          strokeWidth="1.8"
                          strokeDasharray="5 4"
                          points={cageSynthesis.continuousProfile
                            .map((p) => {
                              const x = 50 + (p.travelPct / 100) * 590;
                              const y = 195 - (p.targetCv / maxCvPlot) * 165;
                              return `${x},${y}`;
                            })
                            .join(' ')}
                        />

                        {/* Instantaneous Chord Width Gain dA/dh (Emerald Curve — non-zero everywhere = zero deadband) */}
                        <polyline
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="1.6"
                          strokeOpacity="0.85"
                          points={cageSynthesis.continuousProfile
                            .map((p) => {
                              const x = 50 + (p.travelPct / 100) * 590;
                              const y =
                                195 -
                                (p.instantaneousChordGain_mm2_per_mm / (maxGain * 1.15)) * 165;
                              return `${x},${y}`;
                            })
                            .join(' ')}
                        />

                        {/* Synthesized Circular-Segment Valve Cv(h) Curve (Solid Cyan) */}
                        <polyline
                          fill="none"
                          stroke="#06b6d4"
                          strokeWidth="2.6"
                          points={cageSynthesis.continuousProfile
                            .map((p) => {
                              const x = 50 + (p.travelPct / 100) * 590;
                              const y = 195 - (p.actualSynthesizedCv / maxCvPlot) * 165;
                              return `${x},${y}`;
                            })
                            .join(' ')}
                        />
                      </svg>
                    );
                  })()}
                </div>
              </div>

              {/* Chart B: Sibanda (2022) Eq. 5.10 360° Gallery Circumferential Hole Cv Distribution */}
              <div className="lg:col-span-5 bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Sibanda (2022) Ch. 5 Gallery Circumferential Hole Cv(θ) Profile
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Normalized Local Orifice Capacity around 0°–360° Gallery (Inlet 0° vs. 135°/225° Separation vs. 180° Rear)
                  </p>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  {(() => {
                    const angles = Array.from({ length: 73 }, (_, i) => i * 5);
                    const topRowZ = correlatedValve.stroke_mm * 0.9;
                    const botRowZ = correlatedValve.stroke_mm * 0.12;
                    return (
                      <svg viewBox="0 0 460 230" className="w-full h-52 overflow-visible">
                        {[0, 90, 135, 180, 225, 270, 360].map((deg) => {
                          const x = 42 + (deg / 360) * 395;
                          const isSep = deg === 135 || deg === 225;
                          return (
                            <g key={deg}>
                              <line
                                x1={x}
                                y1={25}
                                x2={x}
                                y2={195}
                                stroke={isSep ? '#f59e0b' : '#1e293b'}
                                strokeDasharray={isSep ? '4 3' : '2 3'}
                                strokeOpacity={isSep ? '0.6' : '1'}
                              />
                              <text
                                x={x}
                                y={214}
                                textAnchor="middle"
                                className={`text-[9.5px] font-mono ${
                                  isSep ? 'fill-amber-400 font-bold' : 'fill-slate-400'
                                }`}
                              >
                                {deg}°
                              </text>
                            </g>
                          );
                        })}

                        {[0.7, 0.85, 1.0, 1.15, 1.3].map((mult) => {
                          const y = 195 - ((mult - 0.7) / 0.6) * 165;
                          return (
                            <g key={mult}>
                              <line
                                x1={42}
                                y1={y}
                                x2={437}
                                y2={y}
                                stroke={mult === 1.0 ? '#334155' : '#1e293b'}
                                strokeDasharray="3 3"
                              />
                              <text
                                x={36}
                                y={y + 3}
                                textAnchor="end"
                                className="fill-slate-400 text-[9.5px] font-mono"
                              >
                                {mult.toFixed(2)}x
                              </text>
                            </g>
                          );
                        })}

                        {/* Upper Row (HT = 0.90) Sibanda Profile */}
                        <polyline
                          fill="none"
                          stroke="#10b981"
                          strokeWidth="2.2"
                          points={angles
                            .map((deg) => {
                              const s = evaluateSibandaLocalHoleFactor({
                                angle_deg: deg,
                                zElevation_mm: topRowZ,
                                stroke_mm: correlatedValve.stroke_mm,
                                holeDia_mm: baseHoleDia_mm,
                                cageID_mm: cageSynthesis.cageID_mm,
                              });
                              const x = 42 + (deg / 360) * 395;
                              const y = 195 - ((s.relativeWeight - 0.7) / 0.6) * 165;
                              return `${x},${y}`;
                            })
                            .join(' ')}
                        />

                        {/* Bottom Seat Row (HT = 0.12) Sibanda Profile */}
                        <polyline
                          fill="none"
                          stroke="#06b6d4"
                          strokeWidth="2.0"
                          strokeDasharray="4 3"
                          points={angles
                            .map((deg) => {
                              const s = evaluateSibandaLocalHoleFactor({
                                angle_deg: deg,
                                zElevation_mm: botRowZ,
                                stroke_mm: correlatedValve.stroke_mm,
                                holeDia_mm: baseHoleDia_mm,
                                cageID_mm: cageSynthesis.cageID_mm,
                              });
                              const x = 42 + (deg / 360) * 395;
                              const y = 195 - ((s.relativeWeight - 0.7) / 0.6) * 165;
                              return `${x},${y}`;
                            })
                            .join(' ')}
                        />
                      </svg>
                    );
                  })()}
                </div>
              </div>
            </div>

            {/* Bottom Row: Discrete Axial Row Schedule Table & 4-Axis CNC G-Code Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-3">
                <h3 className="text-sm font-bold text-slate-100">
                  Zero-Deadband Overlapping Axial Hole Row Schedule (R1 to R{cageSynthesis.rows.length})
                </h3>
                <div className="overflow-x-auto max-h-80">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-700 text-slate-400 bg-slate-900/80 sticky top-0">
                        <th className="py-2 px-2">Row</th>
                        <th className="py-2 px-2">Z Center (Span mm)</th>
                        <th className="py-2 px-2">Hole Ød_k</th>
                        <th className="py-2 px-2">Count n_k</th>
                        <th className="py-2 px-2">Axial Overlap</th>
                        <th className="py-2 px-2">Pitch p_θ (p_θ/d)</th>
                        <th className="py-2 px-2">Ligament w</th>
                        <th className="py-2 px-2">Sibanda HT^c</th>
                        <th className="py-2 px-2">Cum. Cv</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                      {cageSynthesis.rows.map((r) => (
                        <tr key={r.rowIndex} className="hover:bg-slate-900/40">
                          <td className="py-1.5 px-2 font-bold text-cyan-400">R{r.rowIndex}</td>
                          <td className="py-1.5 px-2">
                            {r.zElevation_mm}{' '}
                            <span className="text-slate-500 text-[10px]">
                              [{r.zBottom_mm}–{r.zTop_mm}]
                            </span>
                          </td>
                          <td className="py-1.5 px-2">Ø{r.holeDia_mm} mm</td>
                          <td className="py-1.5 px-2 font-bold text-slate-100">{r.holeCount}</td>
                          <td className="py-1.5 px-2 text-emerald-400 font-semibold">
                            {r.rowIndex === 1 ? 'Seat Tangent' : `${r.axialOverlapPct}%`}
                          </td>
                          <td className="py-1.5 px-2">
                            {r.circumferentialPitch_mm} ({r.pitchToDiaRatio}x)
                          </td>
                          <td className="py-1.5 px-2">{r.ligamentWidth_mm} mm</td>
                          <td className="py-1.5 px-2 text-cyan-300">
                            {r.sibandaRowElevationFactor}x
                          </td>
                          <td className="py-1.5 px-2 font-bold text-emerald-400">
                            {r.cumulativeCv}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* 4-Axis CNC G-Code Terminal */}
              <div className="lg:col-span-5 bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-100">
                    4-Axis Rotary Indexer CNC G-Code (G83 Peck Drill)
                  </h3>
                  <button
                    onClick={handleExportGCode}
                    className="px-2.5 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-700 text-xs font-mono"
                  >
                    Export .NC
                  </button>
                </div>
                <pre className="bg-slate-950 border border-slate-800 rounded-lg p-3.5 text-[11px] font-mono text-emerald-400 overflow-y-auto max-h-80 leading-relaxed">
                  {generate4AxisCageGCode(cageSynthesis).slice(0, 2600)}
                  {'\n... [TRUNCATED IN PREVIEW — CLICK EXPORT .NC FOR FULL PROGRAM]'}
                </pre>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 4: TRANSIENT THERMAL BINDING & BONNET / PACKING ADVISOR
           ===================================================================== */}
        {activeTab === 'TRANSIENT_THERMAL' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Controls */}
            <div className="lg:col-span-4 bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-cyan-400" />
                    Transient Thermal Differential Expansion
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">
                    Lumped-capacitance thermal lag (-196°C to +580°C)
                  </p>
                </div>
                {renderStatusBadge(thermalResult.radialBindingRisk)}
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div>
                  <label className="block text-slate-300 mb-1">Plug Head / Skirt Alloy</label>
                  <select
                    value={plugAlloy}
                    onChange={(e) => setPlugAlloy(e.target.value as ThermalAlloyId)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300"
                  >
                    {Object.values(THERMAL_ALLOYS).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} (α={a.alpha_1e6_per_K} µm/m·K)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Cage Sleeve Guide Alloy</label>
                  <select
                    value={cageAlloy}
                    onChange={(e) => setCageAlloy(e.target.value as ThermalAlloyId)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                  >
                    {Object.values(THERMAL_ALLOYS).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} (α={a.alpha_1e6_per_K} µm/m·K)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">Valve Body Pressure Boundary Alloy</label>
                  <select
                    value={bodyAlloy}
                    onChange={(e) => setBodyAlloy(e.target.value as ThermalAlloyId)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                  >
                    {Object.values(THERMAL_ALLOYS).map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} (α={a.alpha_1e6_per_K} µm/m·K)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-slate-400 mb-1">Initial Temp T0 (°C)</label>
                    <input
                      type="number"
                      value={initialTemp_degC}
                      onChange={(e) => setInitialTemp_degC(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Final Process T_∞ (°C)</label>
                    <input
                      type="number"
                      value={finalProcessTemp_degC}
                      onChange={(e) => setFinalProcessTemp_degC(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Warmup Ramp (°C/min)</label>
                    <input
                      type="number"
                      min="0"
                      value={rampRate_degC_per_min}
                      onChange={(e) => setRampRate_degC_per_min(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Cold Radial Gap (mm)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={coldRadialClearance_mm}
                      onChange={(e) => setColdRadialClearance_mm(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs font-mono text-amber-300 pt-1 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireLethalBellowsSeal}
                    onChange={(e) => setRequireLethalBellowsSeal(e.target.checked)}
                    className="accent-amber-500"
                  />
                  Lethal / Zero-Emission Metallic Bellows Seal Service
                </label>
              </div>

              {/* Thermal Time Constants & Pinch Readout */}
              <div className="bg-slate-900/90 border border-slate-800 rounded-lg p-3.5 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Time Constants (τ_cage / τ_plug / τ_body):</span>
                  <span className="text-cyan-400 font-semibold">
                    {thermalResult.tauCage_s}s / {thermalResult.tauPlug_s}s / {thermalResult.tauBody_s}s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Min Transient Radial Clearance:</span>
                  <span
                    className={
                      thermalResult.minTransientRadialClearance_mm >=
                      thermalResult.minSafeRadialClearanceFloor_mm
                        ? 'text-emerald-400 font-bold'
                        : 'text-red-400 font-bold'
                    }
                  >
                    {thermalResult.minTransientRadialClearance_mm} mm (at t ={' '}
                    {thermalResult.timeOfMinClearance_s}s)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Recommended Cold Radial Clearance:</span>
                  <span className="text-emerald-400 font-bold">
                    ≥ {thermalResult.recommendedColdRadialClearance_mm} mm
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Max Axial Sleeve-in-Body Crush:</span>
                  <span className="text-slate-200">
                    {thermalResult.maxAxialDifferentialExpansion_mm} mm (Limit:{' '}
                    {axialGasketAllowance_mm} mm)
                  </span>
                </div>
              </div>
            </div>

            {/* Right Column: Transient Radial Clearance Pinch Chart & Bonnet Isolation Advisor */}
            <div className="lg:col-span-8 space-y-6">
              {/* Transient Radial Clearance Chart */}
              <div className="bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-3">
                <h3 className="text-sm font-bold text-slate-100">
                  Transient Radial Guide Clearance c_radial(t) & Component Thermal Lag Response
                </h3>
                <p className="text-xs text-slate-400 font-mono">
                  Tracks differential expansion between Austenitic/Martensitic Plug and Cage during thermal transient
                </p>

                <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                  {(() => {
                    const maxTime =
                      thermalResult.timeSeries[thermalResult.timeSeries.length - 1]?.time_s || 300;
                    const maxClearance = Math.max(
                      0.35,
                      ...thermalResult.timeSeries.map((p) => p.radialClearance_mm)
                    );
                    const floorY =
                      200 -
                      (thermalResult.minSafeRadialClearanceFloor_mm / maxClearance) * 170;

                    return (
                      <svg viewBox="0 0 680 230" className="w-full h-56 overflow-visible">
                        {/* Minimum Safe Clearance Floor Line */}
                        <line
                          x1={50}
                          y1={floorY}
                          x2={640}
                          y2={floorY}
                          stroke="#ef4444"
                          strokeWidth="1.5"
                          strokeDasharray="5 4"
                        />
                        <text
                          x={635}
                          y={floorY - 6}
                          textAnchor="end"
                          className="fill-red-400 text-[10px] font-mono font-bold"
                        >
                          ANTI-SEIZURE CLEARANCE FLOOR ({thermalResult.minSafeRadialClearanceFloor_mm}{' '}
                          mm)
                        </text>

                        {/* Radial Clearance Curve */}
                        <polyline
                          fill="none"
                          stroke="#06b6d4"
                          strokeWidth="2.6"
                          points={thermalResult.timeSeries
                            .map((p) => {
                              const x = 50 + (p.time_s / maxTime) * 590;
                              const y =
                                200 -
                                (Math.max(0, p.radialClearance_mm) / maxClearance) * 170;
                              return `${x},${y}`;
                            })
                            .join(' ')}
                        />
                      </svg>
                    );
                  })()}
                </div>
              </div>

              {/* Bonnet Style & Packing Box Thermal Isolation Advisor Card */}
              <div className="bg-slate-800/60 rounded-xl border border-cyan-500/40 p-5 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold">
                    Bonnet Style & Packing Box Thermal Isolation Advisor (Emerson Ch. 3 & Skousen Ch. 2)
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700 text-xs font-mono font-bold">
                    Est. Packing Box Temp: {thermalResult.bonnetAdvisor.estimatedPackingBoxTemp_degC} °C
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-100">
                  {thermalResult.bonnetAdvisor.bonnetTitle}
                </h3>
                <p className="text-xs font-mono text-slate-300">
                  Recommended Packing Arrangement:{' '}
                  <strong className="text-emerald-400">
                    {thermalResult.bonnetAdvisor.recommendedPackingSystem}
                  </strong>
                </p>
                <p className="text-xs text-slate-400 font-mono leading-relaxed">
                  {thermalResult.bonnetAdvisor.bonnetRationale}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 5: BALANCED VS. UNBALANCED PLUGS, BENCH SET & STEM SIZING
           ===================================================================== */}
        {activeTab === 'ACTUATOR_STEM' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Controls: Shutoff Class, Packing, Actuator Bench Set & Stem Material */}
            <div className="lg:col-span-4 bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
                <div>
                  <h2 className="text-sm font-bold text-slate-100">
                    Actuator Bench Set & Stem Structural Inputs
                  </h2>
                  <p className="text-xs text-slate-400 font-mono">
                    F_total = A + B + C + D & Euler Column Buckling
                  </p>
                </div>
                {renderStatusBadge(actuatorStemResult.stemStructuralStatus)}
              </div>

              <div className="space-y-3 text-xs font-mono">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">
                      ANSI/FCI 70-2 Shutoff Class
                    </label>
                    <select
                      value={shutoffClass}
                      onChange={(e) => setShutoffClass(e.target.value as ShutoffClassId)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-cyan-300"
                    >
                      <option value="CLASS_II">Class II (0.5% Metal)</option>
                      <option value="CLASS_III">Class III (0.1% Metal)</option>
                      <option value="CLASS_IV">Class IV (0.01% Std Metal)</option>
                      <option value="CLASS_V">Class V (Tight Metal Letdown)</option>
                      <option value="CLASS_VI">Class VI (Soft Seat PTFE)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Stem Packing Type</label>
                    <select
                      value={packingType}
                      onChange={(e) => setPackingType(e.target.value as PackingTypeId)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-100"
                    >
                      <option value="SINGLE_PTFE_V_RING">Single PTFE V-Ring</option>
                      <option value="DOUBLE_PTFE_LIVE_LOADED">Live-Loaded PTFE</option>
                      <option value="GRAPHITE_ULF_LIVE_LOADED">Graphite ULF Live</option>
                      <option value="HIGH_TEMP_BRAIDED_GRAPHITE">High-Temp Graphite</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">Balanced Plug Seal</label>
                    <select
                      value={balanceSealType}
                      onChange={(e) => setBalanceSealType(e.target.value as BalanceSealTypeId)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-slate-100"
                    >
                      <option value="PTFE_SPRING_ENERGIZED">Spring-Energized PTFE</option>
                      <option value="GRAPHITE_PISTON_RING">High-Temp Graphite Ring</option>
                      <option value="NONE_METAL_CLEARANCE">Metal Clearance Seal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Actuator Fail Action</label>
                    <select
                      value={failAction}
                      onChange={(e) => setFailAction(e.target.value as FailActionId)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-cyan-300"
                    >
                      <option value="FAIL_CLOSED_ATO">Fail-Closed (Spring-to-Close)</option>
                      <option value="FAIL_OPEN_ATC">Fail-Open (Air-to-Close)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Diaphragm Area A_eff (cm²)
                    </label>
                    <input
                      type="number"
                      step="50"
                      value={actuatorArea_cm2}
                      onChange={(e) => setActuatorArea_cm2(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Supply Air P_supply (bar g)
                    </label>
                    <input
                      type="number"
                      step="0.2"
                      value={airSupply_bar_g}
                      onChange={(e) => setAirSupply_bar_g(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Bench Set Lower (bar g)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={benchSetLower_bar_g}
                      onChange={(e) => setBenchSetLower_bar_g(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Bench Set Upper (bar g)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={benchSetUpper_bar_g}
                      onChange={(e) => setBenchSetUpper_bar_g(Number(e.target.value))}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-700/60 pt-3 space-y-3">
                  <div>
                    <label className="block text-slate-300 mb-1">Stem Bar Material</label>
                    <select
                      value={stemMaterial}
                      onChange={(e) => setStemMaterial(e.target.value as StemMaterialId)}
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-cyan-300"
                    >
                      {Object.values(STEM_MATERIALS).map((sm) => (
                        <option key={sm.id} value={sm.id}>
                          {sm.name} (Sy={sm.Sy_20C_MPa} MPa)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1">
                        Selected Stem Ød_stem (mm)
                      </label>
                      <select
                        value={selectedStemDia_mm}
                        onChange={(e) => setSelectedStemDia_mm(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                      >
                        {STANDARD_METRIC_STEM_DIAMETERS_MM.map((d) => (
                          <option key={d} value={d}>
                            Ø{d} mm
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">
                        Unsupported Stem L (mm)
                      </label>
                      <input
                        type="number"
                        step="10"
                        value={unsupportedStemLength_mm}
                        onChange={(e) => setUnsupportedStemLength_mm(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-slate-100"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Side-by-Side Unbalanced vs Balanced Thrust & Stem Buckling Verification */}
            <div className="lg:col-span-8 space-y-6">
              {/* Unbalanced vs Balanced Plug Force Breakdown Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Unbalanced Plug Card */}
                <div className="bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-3 font-mono">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-slate-100">
                      Unbalanced Single-Seated Plug
                    </h3>
                    {renderStatusBadge(
                      actuatorStemResult.actuatorMarginUnbalancedPct >= 0
                        ? 'PASS'
                        : 'WARNING',
                      `${actuatorStemResult.actuatorMarginUnbalancedPct > 0 ? '+' : ''}${
                        actuatorStemResult.actuatorMarginUnbalancedPct
                      }% Margin`
                    )}
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Force A (Fluid Unbalance):</span>
                      <span>{actuatorStemResult.unbalanced.fluidUnbalanceForceA_N.toLocaleString()} N</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Force B (FCI 70-2 Seat Load):</span>
                      <span>{actuatorStemResult.unbalanced.seatLoadForceB_N.toLocaleString()} N</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Force C (Packing Friction):</span>
                      <span>{actuatorStemResult.unbalanced.packingFrictionForceC_N.toLocaleString()} N</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Force D (Bellows / Drag):</span>
                      <span>{actuatorStemResult.unbalanced.sealAndBellowsForceD_N.toLocaleString()} N</span>
                    </div>
                    <div className="border-t border-slate-700 pt-2 flex justify-between font-bold text-sm text-amber-400">
                      <span>Required Thrust (1.25x SF):</span>
                      <span>{actuatorStemResult.unbalanced.totalWithSafetyMargin_N.toLocaleString()} N</span>
                    </div>
                  </div>
                </div>

                {/* Balanced Cage-Guided Plug Card */}
                <div className="bg-slate-800/60 rounded-xl border border-cyan-500/40 p-5 shadow-xl space-y-3 font-mono">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-cyan-300">
                      Balanced Cage-Guided Plug (-{actuatorStemResult.thrustReductionPct}% Thrust)
                    </h3>
                    {renderStatusBadge(
                      actuatorStemResult.actuatorMarginBalancedPct >= 0 ? 'PASS' : 'CRITICAL',
                      `${actuatorStemResult.actuatorMarginBalancedPct > 0 ? '+' : ''}${
                        actuatorStemResult.actuatorMarginBalancedPct
                      }% Margin`
                    )}
                  </div>
                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-300">
                      <span>Force A (Balanced Annulus):</span>
                      <span className="text-emerald-400">
                        {actuatorStemResult.balanced.fluidUnbalanceForceA_N.toLocaleString()} N
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Force B (FCI 70-2 Seat Load):</span>
                      <span>{actuatorStemResult.balanced.seatLoadForceB_N.toLocaleString()} N</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Force C (Packing Friction):</span>
                      <span>{actuatorStemResult.balanced.packingFrictionForceC_N.toLocaleString()} N</span>
                    </div>
                    <div className="flex justify-between text-slate-300">
                      <span>Force D (Balance Seal + Bellows):</span>
                      <span>{actuatorStemResult.balanced.sealAndBellowsForceD_N.toLocaleString()} N</span>
                    </div>
                    <div className="border-t border-slate-700 pt-2 flex justify-between font-bold text-sm text-cyan-400">
                      <span>Required Thrust (1.25x SF):</span>
                      <span>{actuatorStemResult.balanced.totalWithSafetyMargin_N.toLocaleString()} N</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operational Stem Structural & Euler Buckling Verification Card */}
              <div className="bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      Operational Stem Diameter & Euler Column Buckling Verification
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Evaluates thread-root tensile stress, compressive yield, and slender column buckling (SF ≥ 2.5)
                    </p>
                  </div>
                  {renderStatusBadge(actuatorStemResult.stemStructuralStatus)}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                    <span className="block text-[10px] text-slate-400 uppercase">
                      Available Seating Thrust
                    </span>
                    <span className="text-sm font-bold text-cyan-400">
                      {actuatorStemResult.availableActuatorSeatingThrust_N.toLocaleString()} N
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      Rec Area: {actuatorStemResult.recommendedActuatorArea_cm2} cm²
                    </span>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                    <span className="block text-[10px] text-slate-400 uppercase">
                      Root Tensile Stress
                    </span>
                    <span className="text-sm font-bold text-slate-100">
                      {actuatorStemResult.directTensileStress_MPa} MPa
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      Allowable Sm: {actuatorStemResult.allowableTensileSm_MPa} MPa
                    </span>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                    <span className="block text-[10px] text-slate-400 uppercase">
                      Euler Critical Buckling P_cr
                    </span>
                    <span className="text-sm font-bold text-emerald-400">
                      {(actuatorStemResult.eulerCriticalBucklingLoad_N / 1000).toFixed(1)} kN
                    </span>
                    <span className="block text-[10px] text-slate-500">
                      Buckling SF = {actuatorStemResult.bucklingSafetyFactor}x (KL/r ={' '}
                      {actuatorStemResult.slendernessRatioKL_r})
                    </span>
                  </div>

                  <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800">
                    <span className="block text-[10px] text-slate-400 uppercase">
                      Min Required Stem Ø
                    </span>
                    <span className="text-sm font-bold text-cyan-400">
                      {actuatorStemResult.minRequiredStemDia_mm} mm
                    </span>
                    <span className="block text-[10px] text-emerald-400">
                      Std Schedule: Ø{actuatorStemResult.recommendedStandardStem_mm} mm
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            TAB 6: MANUFACTURER-AGNOSTIC MASTER VALVE CORRELATION SCHEDULE
           ===================================================================== */}
        {activeTab === 'MASTER_SCHEDULE' && (
          <div className="space-y-6">
            {/* Governing Equations Card */}
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-3">
              <h2 className="text-sm font-bold text-slate-100">
                Universal Manufacturer-Agnostic Control Valve Correlation Equations (IEC 60534 / ISA-75)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800">
                  <span className="text-cyan-400 font-bold block mb-1">
                    1. Specific Capacity Index (Cd = Cv / d²)
                  </span>
                  <p className="text-slate-300">
                    Cv_rated = Cd · K_class · K_body · F_reduced · d_in²
                  </p>
                  <p className="text-slate-400 text-[11px] mt-1">
                    Contoured Linear Cd≈16.0 | Contoured Eq% Cd≈14.0 | 1-Stage Drilled Cage Cd≈11.5 | 2-Stage Cd≈8.0 | 3-Stage Cd≈5.0
                  </p>
                </div>
                <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800">
                  <span className="text-cyan-400 font-bold block mb-1">
                    2. Curtain-to-Seat Stroke Rule (H vs. d_port)
                  </span>
                  <p className="text-slate-300">
                    A_curtain = π · d_port · H · η_open ≥ (π/4) · d_port²
                  </p>
                  <p className="text-slate-400 text-[11px] mt-1">
                    Requires H / d_port ≥ 1 / (4 · η_open). Multi-stage drilled cages use Extended Stroke H_ext to recover full seat capacity.
                  </p>
                </div>
                <div className="bg-slate-900/90 p-3.5 rounded-lg border border-slate-800">
                  <span className="text-cyan-400 font-bold block mb-1">
                    3. Composite Series-Resistance Cv_total
                  </span>
                  <p className="text-slate-300">
                    1 / Cv_rated² = 1 / Cv_trim² + 1 / Cv_seat² + 1 / Cv_body²
                  </p>
                  <p className="text-slate-400 text-[11px] mt-1">
                    Couples physical drilled orifice area (A_holes) in series with Seat Port Bore and Body Gallery losses.
                  </p>
                </div>
              </div>
            </div>

            {/* Interactive Master Schedule Table (DN15 to DN600) */}
            <div className="bg-slate-800/60 rounded-xl border border-slate-700/60 p-5 shadow-xl space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    Standardized Generic Control Valve Master Schedule (DN15 / 1/2" to DN600 / 24")
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Click any row to load that valve size directly into the active CAE workbench
                  </p>
                </div>
                <span className="text-xs font-mono text-cyan-400">
                  Active Class Multiplier K_class ={' '}
                  {PRESSURE_CLASSES[pressureClass].capacityMultiplierKClass.toFixed(2)} (
                  {PRESSURE_CLASSES[pressureClass].label})
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-700 text-slate-400 bg-slate-900/80">
                      <th className="py-2.5 px-3">Size (DN / NPS)</th>
                      <th className="py-2.5 px-2">Seat Bore Ød_port</th>
                      <th className="py-2.5 px-2">Std Stroke H_std</th>
                      <th className="py-2.5 px-2">Ext Stroke H_ext</th>
                      <th className="py-2.5 px-2">Stem Ø (Std/Hvy)</th>
                      <th className="py-2.5 px-2">Min Body Wall ({pressureClass.split('_')[0]})</th>
                      <th className="py-2.5 px-2">Contoured Lin Cv</th>
                      <th className="py-2.5 px-2">Contoured Eq% Cv</th>
                      <th className="py-2.5 px-2 text-cyan-400">1-Stage Cage Cv</th>
                      <th className="py-2.5 px-2 text-emerald-400">2-Stage Cage Cv</th>
                      <th className="py-2.5 px-2 text-amber-400">3-Stage / Tortuous Cv</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {GENERIC_VALVE_SCHEDULE.map((s) => {
                      const kClass =
                        PRESSURE_CLASSES[pressureClass].capacityMultiplierKClass;
                      const isSelected = s.dn === selectedDN;
                      return (
                        <tr
                          key={s.dn}
                          onClick={() => handleSelectSizeFromSchedule(s.dn)}
                          className={`cursor-pointer transition ${
                            isSelected
                              ? 'bg-cyan-950/50 border-l-2 border-cyan-400'
                              : 'hover:bg-slate-900/50'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-bold text-slate-100">
                            DN{s.dn} ({s.npsLabel})
                          </td>
                          <td className="py-2.5 px-2">
                            {s.d_port_mm} mm ({s.d_port_in}")
                          </td>
                          <td className="py-2.5 px-2">
                            {s.strokeStd_mm} mm ({s.strokeStd_in}")
                          </td>
                          <td className="py-2.5 px-2 text-slate-400">
                            {s.strokeExt_mm} mm ({s.strokeExt_in}")
                          </td>
                          <td className="py-2.5 px-2">
                            Ø{s.stemDiaStd_mm} / Ø{s.stemDiaHeavy_mm} mm
                          </td>
                          <td className="py-2.5 px-2">
                            {s.bodyMinWall_mm[pressureClass]} mm
                          </td>
                          <td className="py-2.5 px-2">
                            {(s.ratedCvBaseline.CONTOURED_LINEAR * kClass).toFixed(1)}
                          </td>
                          <td className="py-2.5 px-2">
                            {(s.ratedCvBaseline.CONTOURED_EQP * kClass).toFixed(1)}
                          </td>
                          <td className="py-2.5 px-2 font-bold text-cyan-400">
                            {(s.ratedCvBaseline.CAGE_1STAGE * kClass).toFixed(1)}
                          </td>
                          <td className="py-2.5 px-2 font-bold text-emerald-400">
                            {(s.ratedCvBaseline.CAGE_2STAGE * kClass).toFixed(1)}
                          </td>
                          <td className="py-2.5 px-2 font-bold text-amber-400">
                            {(s.ratedCvBaseline.CAGE_3STAGE * kClass).toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
