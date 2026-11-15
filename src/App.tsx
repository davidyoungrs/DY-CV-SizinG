import React, { useState, useMemo, useRef, useEffect } from 'react';
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
  Info,
  ChevronDown,
  Upload,
  Save,
  Globe,
} from 'lucide-react';

import {
  GeneralUnitSystem,
  ProcessUnitsState,
  DEFAULT_METRIC_UNITS,
  DEFAULT_ENGLISH_UNITS,
  fromInternalFlow,
  toInternalFlow,
  fromInternalPressure,
  toInternalPressure,
  fromInternalTemperature,
  toInternalTemperature,
  fromInternalDensity,
  toInternalDensity,
  fromInternalViscosity,
  toInternalViscosity,
  FlowUnit,
  PressureUnit,
  TemperatureUnit,
  DensityUnit,
  ViscosityUnit,
} from './engine/unitConversions';

import {
  PRESSURE_CLASSES,
  TRIM_STYLES,
  GENERIC_VALVE_SCHEDULE,
  REDUCED_TRIM_FACTORS,
  ROTARY_VALVE_BENCHMARKS,
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
  evaluateBackpressureOrificeSharing,
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
  HOLE_SPACING_RULES,
  HoleSpacingRuleId,
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

  // General Unit System ('METRIC' | 'ENGLISH') and granular row-level process unit selections
  const [unitSystem, setUnitSystem] = useState<GeneralUnitSystem>('METRIC');
  const [processUnits, setProcessUnits] = useState<ProcessUnitsState>(DEFAULT_METRIC_UNITS);

  // Tools menu dropdown toggle
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState<boolean>(false);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Close tools menu on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setIsToolsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // When general unit system changes, switch default row units accordingly
  const handleUnitSystemChange = (newSystem: GeneralUnitSystem) => {
    setUnitSystem(newSystem);
    setProcessUnits(newSystem === 'METRIC' ? { ...DEFAULT_METRIC_UNITS } : { ...DEFAULT_ENGLISH_UNITS });
  };

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
  const [enableBackpressureOrifice, setEnableBackpressureOrifice] = useState<boolean>(false);
  const [orificeDeltaPSharePct, setOrificeDeltaPSharePct] = useState<number>(45);

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
  const [holeSpacingRule, setHoleSpacingRule] = useState<HoleSpacingRuleId>('STD_HIGH_CAP_1_75D');
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
        holeSpacingRule,
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
      holeSpacingRule,
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
            stroke_mm: correlatedValve.stroke_mm,
            flowDirection,
            cageMaterialId: cageMaterial,
          })
        ),
    [
      operatingCases,
      piping,
      correlatedValve,
      cageSynthesis,
      trimStyle,
      charConfig,
      flowDirection,
      cageMaterial,
    ]
  );

  const backpressureOrificeResult = useMemo(
    () =>
      enableBackpressureOrifice
        ? evaluateBackpressureOrificeSharing({
            cases: operatingCases.filter((c) => c.enabled),
            downstreamPipeID_mm: piping.downstreamPipeID_mm,
            orificeDeltaPShareAtMaxPct: orificeDeltaPSharePct,
          })
        : null,
    [
      enableBackpressureOrifice,
      operatingCases,
      piping.downstreamPipeID_mm,
      orificeDeltaPSharePct,
    ]
  );

  // Automated Valve Size & Pressure Rating Recommender based on all process conditions (60–90% Max Cv Rule)
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
        characteristicType: charConfig.type,
        equalPctRangeability: charConfig.equalPctRangeability,
      }),
    [
      operatingCases,
      piping,
      trimStyle,
      bodyStyle,
      flowDirection,
      reducedTrimFactor,
      useExtendedStroke,
      charConfig.type,
      charConfig.equalPctRangeability,
    ]
  );

  const charSimulation = useMemo(() => {
    const activeCvs = caseResults.map((r) => r.requiredCv).filter((v) => v > 0);
    return simulateCharacteristicCurves({
      config: charConfig,
      ratedCv: correlatedValve.ratedCv,
      stroke_mm: correlatedValve.stroke_mm,
      maxSystemDeltaP_bar: maxShutoffDeltaP_bar,
      maxOperatingRequiredCv: activeCvs.length > 0 ? Math.max(...activeCvs) : undefined,
      minOperatingRequiredCv: activeCvs.length > 0 ? Math.min(...activeCvs) : undefined,
    });
  }, [charConfig, correlatedValve, maxShutoffDeltaP_bar, caseResults]);

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
        massFractionGas_fg: preset.massFractionGas_fg,
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

  // --- SAVE & LOAD .DYSol PROJECT FILES ---
  const handleSaveDYSol = () => {
    const projectData = {
      fileType: 'DYSol',
      version: '2.0.0',
      timestamp: new Date().toISOString(),
      unitSystem,
      processUnits,
      inputs: {
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
        enableBackpressureOrifice,
        orificeDeltaPSharePct,
        piping,
        operatingCases,
        charConfig,
        numRows,
        baseHoleDia_mm,
        modulateHoleDiameter,
        enforceZeroDeadbandOverlap,
        targetRowOverlapPct,
        holeSpacingRule,
        showSibandaGalleryHeatmap,
        selectedWallThickness_mm,
        erosionAllowance_mm,
        cageMaterial,
        requireNaceSourService,
        livePlugTravelPct,
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
        selectedStemDia_mm,
        unsupportedStemLength_mm,
        shutoffClass,
        packingType,
        balanceSealType,
        failAction,
        actuatorArea_cm2,
        airSupply_bar_g,
        benchSetLower_bar_g,
        benchSetUpper_bar_g,
        stemMaterial,
      },
      outputs: {
        correlatedValve,
        caseResults,
        valveRecommendation,
        charSimulation,
        cageSynthesis,
        thermalResult,
        actuatorStemResult,
        backpressureOrificeResult,
      },
    };

    const jsonStr = JSON.stringify(projectData, null, 2);
    downloadTextFile(`DY_SIZE_DN${selectedDN}_VALVE_CASE.DYSol`, jsonStr, 'application/json');
  };

  const handleLoadDYSolClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const data = JSON.parse(text);

        if (data.unitSystem) setUnitSystem(data.unitSystem);
        if (data.processUnits) setProcessUnits(data.processUnits);

        const inp = data.inputs || data;
        if (inp.selectedDN !== undefined) setSelectedDN(inp.selectedDN);
        if (inp.pressureClass !== undefined) setPressureClass(inp.pressureClass);
        if (inp.bodyStyle !== undefined) setBodyStyle(inp.bodyStyle);
        if (inp.trimStyle !== undefined) setTrimStyle(inp.trimStyle);
        if (inp.flowDirection !== undefined) setFlowDirection(inp.flowDirection);
        if (inp.reducedTrimFactor !== undefined) setReducedTrimFactor(inp.reducedTrimFactor);
        if (inp.useExtendedStroke !== undefined) setUseExtendedStroke(inp.useExtendedStroke);
        if (inp.customBoreOverride !== undefined) setCustomBoreOverride(inp.customBoreOverride);
        if (inp.customStrokeOverride !== undefined) setCustomStrokeOverride(inp.customStrokeOverride);
        if (inp.customRatedCvOverride !== undefined) setCustomRatedCvOverride(inp.customRatedCvOverride);
        if (inp.enableBackpressureOrifice !== undefined) setEnableBackpressureOrifice(inp.enableBackpressureOrifice);
        if (inp.orificeDeltaPSharePct !== undefined) setOrificeDeltaPSharePct(inp.orificeDeltaPSharePct);
        if (inp.piping) setPiping(inp.piping);
        if (Array.isArray(inp.operatingCases)) setOperatingCases(inp.operatingCases);
        if (inp.charConfig) setCharConfig(inp.charConfig);
        if (inp.numRows !== undefined) setNumRows(inp.numRows);
        if (inp.baseHoleDia_mm !== undefined) setBaseHoleDia_mm(inp.baseHoleDia_mm);
        if (inp.modulateHoleDiameter !== undefined) setModulateHoleDiameter(inp.modulateHoleDiameter);
        if (inp.enforceZeroDeadbandOverlap !== undefined) setEnforceZeroDeadbandOverlap(inp.enforceZeroDeadbandOverlap);
        if (inp.targetRowOverlapPct !== undefined) setTargetRowOverlapPct(inp.targetRowOverlapPct);
        if (inp.holeSpacingRule !== undefined) setHoleSpacingRule(inp.holeSpacingRule);
        if (inp.showSibandaGalleryHeatmap !== undefined) setShowSibandaGalleryHeatmap(inp.showSibandaGalleryHeatmap);
        if (inp.selectedWallThickness_mm !== undefined) setSelectedWallThickness_mm(inp.selectedWallThickness_mm);
        if (inp.erosionAllowance_mm !== undefined) setErosionAllowance_mm(inp.erosionAllowance_mm);
        if (inp.cageMaterial !== undefined) setCageMaterial(inp.cageMaterial);
        if (inp.requireNaceSourService !== undefined) setRequireNaceSourService(inp.requireNaceSourService);
        if (inp.livePlugTravelPct !== undefined) setLivePlugTravelPct(inp.livePlugTravelPct);
        if (inp.coldRadialClearance_mm !== undefined) setColdRadialClearance_mm(inp.coldRadialClearance_mm);
        if (inp.axialGasketAllowance_mm !== undefined) setAxialGasketAllowance_mm(inp.axialGasketAllowance_mm);
        if (inp.plugAlloy !== undefined) setPlugAlloy(inp.plugAlloy);
        if (inp.cageAlloy !== undefined) setCageAlloy(inp.cageAlloy);
        if (inp.bodyAlloy !== undefined) setBodyAlloy(inp.bodyAlloy);
        if (inp.initialTemp_degC !== undefined) setInitialTemp_degC(inp.initialTemp_degC);
        if (inp.finalProcessTemp_degC !== undefined) setFinalProcessTemp_degC(inp.finalProcessTemp_degC);
        if (inp.rampRate_degC_per_min !== undefined) setRampRate_degC_per_min(inp.rampRate_degC_per_min);
        if (inp.convectiveH_W_m2K !== undefined) setConvectiveH_W_m2K(inp.convectiveH_W_m2K);
        if (inp.requireLethalBellowsSeal !== undefined) setRequireLethalBellowsSeal(inp.requireLethalBellowsSeal);
        if (inp.selectedStemDia_mm !== undefined) setSelectedStemDia_mm(inp.selectedStemDia_mm);
        if (inp.unsupportedStemLength_mm !== undefined) setUnsupportedStemLength_mm(inp.unsupportedStemLength_mm);
        if (inp.shutoffClass !== undefined) setShutoffClass(inp.shutoffClass);
        if (inp.packingType !== undefined) setPackingType(inp.packingType);
        if (inp.balanceSealType !== undefined) setBalanceSealType(inp.balanceSealType);
        if (inp.failAction !== undefined) setFailAction(inp.failAction);
        if (inp.actuatorArea_cm2 !== undefined) setActuatorArea_cm2(inp.actuatorArea_cm2);
        if (inp.airSupply_bar_g !== undefined) setAirSupply_bar_g(inp.airSupply_bar_g);
        if (inp.benchSetLower_bar_g !== undefined) setBenchSetLower_bar_g(inp.benchSetLower_bar_g);
        if (inp.benchSetUpper_bar_g !== undefined) setBenchSetUpper_bar_g(inp.benchSetUpper_bar_g);
        if (inp.stemMaterial !== undefined) setStemMaterial(inp.stemMaterial);

        alert(`Successfully loaded project file: ${file.name}`);
      } catch (err: any) {
        alert(`Failed to load .DYSol file: ${err?.message || err}`);
      }
    };
    reader.readAsText(file);
  };

  const renderStatusBadge = (status: 'PASS' | 'WARNING' | 'CRITICAL', text?: string) => {
    if (status === 'PASS') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#182028] text-[#8be0a8] border border-[#2f3b47]">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {text || 'PASS'}
        </span>
      );
    }
    if (status === 'WARNING') {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#182028] text-[#ffd77a] border border-[#2f3b47]">
          <AlertTriangle className="w-3.5 h-3.5" />
          {text || 'WARNING'}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-[#182028] text-[#ff8a80] border border-[#2f3b47]">
        <XCircle className="w-3.5 h-3.5" />
        {text || 'CRITICAL'}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#edf1f5] text-[#0b2545] flex flex-col">
      {/* DY-MIMIC DEEP NAVY MASTHEAD WITH 4PX SAFETY AMBER BOTTOM BORDER */}
      <header className="sticky top-0 z-50 bg-[#0b2545] border-b-4 border-[#f2a900] px-6 py-3.5 shadow-md no-print">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#13315c] border border-[#f2a900]/60 flex items-center justify-center text-[#ffd77a] shadow-sm">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-base font-bold tracking-tight text-white">
                  DY-SIZE // CONTROL VALVE & DRILLED CAGE CAE SUITE
                </h1>
                <span className="px-2 py-0.5 rounded bg-[#13315c] text-[#ffd77a] border border-[#f2a900]/40 font-mono text-[11px] font-semibold">
                  IEC 60534 • ASME B16.34 • ISA-75
                </span>
              </div>
              <p className="text-xs text-slate-300 font-mono">
                Manufacturer-Agnostic Valve Correlation • Installed Gain • Hoop Stress • Transient Thermal • Actuator/Stem
              </p>
            </div>
          </div>

          {/* TOP RIGHT TOOLBAR: GENERAL UNIT SYSTEM & TOOLS MENU */}
          <div className="flex items-center gap-3">
            {/* Hidden file input for loading .DYSol */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".dysol,.json"
              className="hidden"
            />

            {/* General Unit System Selection (Metric vs English) */}
            <div className="flex items-center bg-[#13315c] p-1 rounded-lg border border-[#f2a900]/40 text-xs font-mono">
              <span className="text-slate-300 px-2 flex items-center gap-1">
                <Globe className="w-3.5 h-3.5 text-[#ffd77a]" />
                Units:
              </span>
              <button
                type="button"
                onClick={() => handleUnitSystemChange('METRIC')}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  unitSystem === 'METRIC'
                    ? 'bg-[#0f8b8d] text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title="Switch all default process rows to Metric (m³/h, bar a, °C, kg/m³)"
              >
                Metric
              </button>
              <button
                type="button"
                onClick={() => handleUnitSystemChange('ENGLISH')}
                className={`px-2.5 py-1 rounded font-semibold transition ${
                  unitSystem === 'ENGLISH'
                    ? 'bg-[#0f8b8d] text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10'
                }`}
                title="Switch all default process rows to English / Imperial (gpm, psia, °F, lb/ft³)"
              >
                English
              </button>
            </div>

            {/* TOOLS MENU DROPDOWN */}
            <div className="relative" ref={toolsMenuRef}>
              <button
                type="button"
                onClick={() => setIsToolsMenuOpen((prev) => !prev)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#13315c] hover:bg-[#0f8b8d] text-white border border-[#0f8b8d]/70 text-xs font-mono font-semibold transition shadow-sm"
                aria-expanded={isToolsMenuOpen}
                aria-haspopup="true"
              >
                <Wrench className="w-3.5 h-3.5 text-[#ffd77a]" />
                Tools
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isToolsMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isToolsMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 rounded-xl bg-[#0f1419] border border-[#2f3b47] shadow-2xl py-2 z-50 text-xs font-mono divide-y divide-[#2f3b47]/60">
                  {/* File Save / Load group */}
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        handleSaveDYSol();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#182028] text-slate-200 hover:text-[#7fe0e2] flex items-center gap-2.5 transition"
                    >
                      <Save className="w-4 h-4 text-[#7fe0e2]" />
                      <div>
                        <div className="font-semibold text-white">Save .DYSol File</div>
                        <div className="text-[10px] text-slate-400">Save complete inputs & outputs</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        handleLoadDYSolClick();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#182028] text-slate-200 hover:text-[#8be0a8] flex items-center gap-2.5 transition"
                    >
                      <Upload className="w-4 h-4 text-[#8be0a8]" />
                      <div>
                        <div className="font-semibold text-white">Load .DYSol File</div>
                        <div className="text-[10px] text-slate-400">Restore sizing & valve state</div>
                      </div>
                    </button>
                  </div>

                  {/* CAD, CNC & Schedule Exports */}
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        handleExportDXF();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#182028] text-slate-200 hover:text-white flex items-center gap-2.5 transition"
                    >
                      <Download className="w-4 h-4 text-[#7fe0e2]" />
                      <div>
                        <div className="font-semibold text-white">.DXF CAD</div>
                        <div className="text-[10px] text-slate-400">2D unrolled cage perforation</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        handleExportGCode();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#182028] text-slate-200 hover:text-white flex items-center gap-2.5 transition"
                    >
                      <FileCode className="w-4 h-4 text-[#8be0a8]" />
                      <div>
                        <div className="font-semibold text-white">4-AXIS G-CODE</div>
                        <div className="text-[10px] text-slate-400">CNC 4-axis rotary indexer code</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        handleExportCSV();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#182028] text-slate-200 hover:text-white flex items-center gap-2.5 transition"
                    >
                      <Table className="w-4 h-4 text-[#ffd77a]" />
                      <div>
                        <div className="font-semibold text-white">.CSV SCHEDULE</div>
                        <div className="text-[10px] text-slate-400">Drilled cage row perforation matrix</div>
                      </div>
                    </button>
                  </div>

                  {/* Print Datasheet */}
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        window.print();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#182028] text-slate-200 hover:text-[#ffd77a] flex items-center gap-2.5 transition"
                    >
                      <Printer className="w-4 h-4 text-[#ffd77a]" />
                      <div>
                        <div className="font-semibold text-white">PRINT DATASHEET</div>
                        <div className="text-[10px] text-slate-400">Print clean engineering report</div>
                      </div>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* MAIN WORKBENCH CONTENT AREA */}
      <main className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6 space-y-6">
        {/* =====================================================================
            TAB 1: MULTI-CONDITION PROCESS SIZING, SWAGED PIPING & ACOUSTIC NOISE
           ===================================================================== */}
        {activeTab === 'PROCESS_SIZING' && (
          <div className="space-y-6">
            {/* Multi-Condition Operating Inputs Table */}
            <div className="dy-card overflow-hidden">
              <div className="section-band px-5 py-3.5 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Multi-Condition Process Operating Cases (Min / Normal / Max / Start-Up / Upset)
                  </h2>
                  <p className="text-xs text-slate-300 font-mono">
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
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0f8b8d] hover:bg-[#0d7678] text-white text-xs font-mono font-semibold transition"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Operating Case
                </button>
              </div>

              {/* QUICK CHARACTERISTIC SELECTOR & TOGGLES (LINKED TO TAB 2 & TAB 3) */}
              <div className="bg-[#182028] px-5 py-2.5 border-b border-[#2f3b47] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="text-slate-300 flex items-center gap-1.5 font-semibold">
                    <Sliders className="w-3.5 h-3.5 text-[#ffd77a]" />
                    Flow Characteristic:
                  </span>
                  <div className="inline-flex rounded-lg p-0.5 bg-[#0f1419] border border-[#2f3b47]">
                    {(
                      [
                        { id: 'LINEAR', label: 'Linear' },
                        { id: 'EQUAL_PCT', label: `Equal % (R=${charConfig.equalPctRangeability})` },
                        { id: 'BI_LINEAR', label: 'Bi-Linear' },
                        { id: 'QUICK_OPENING', label: 'Quick Open' },
                      ] as const
                    ).map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setCharConfig({ ...charConfig, type: opt.id })}
                        className={`px-2.5 py-1 rounded text-xs transition font-semibold ${
                          charConfig.type === opt.id
                            ? 'bg-[#0f8b8d] text-white shadow'
                            : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  <select
                    value={charConfig.type}
                    onChange={(e) =>
                      setCharConfig({
                        ...charConfig,
                        type: e.target.value as CharacteristicTypeId,
                      })
                    }
                    className="bg-[#0f1419] border border-[#2f3b47] text-slate-200 rounded px-2.5 py-1 text-xs focus:border-[#0f8b8d] focus:outline-none"
                    title="Trim Characteristic Law"
                  >
                    <option value="EQUAL_PCT">Equal-Percentage (R^((h-1)))</option>
                    <option value="LINEAR">Linear (φ = h)</option>
                    <option value="MODIFIED_EQUAL_PCT">Modified Equal-% / Parabolic High-Lift</option>
                    <option value="BI_LINEAR">Bi-Linear / Dual-Slope</option>
                    <option value="QUICK_OPENING">Quick-Opening (φ = h^0.45)</option>
                    <option value="MODIFIED_PARABOLIC">Modified Parabolic (φ = h^1.75)</option>
                    <option value="CUSTOM_SPLINE">Custom Multi-Point Spline Table</option>
                    <option value="AUTO_FIT_CONSTANT_GAIN">Auto-Fit Constant Installed Gain</option>
                  </select>
                </div>

                <div className="flex items-center gap-3">
                  {(charConfig.type === 'EQUAL_PCT' || charConfig.type === 'MODIFIED_EQUAL_PCT') && (
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <span className="text-[11px]">Rangeability:</span>
                      {[30, 50, 100].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setCharConfig({ ...charConfig, equalPctRangeability: r })}
                          className={`px-2 py-0.5 rounded text-[11px] border transition ${
                            charConfig.equalPctRangeability === r
                              ? 'bg-[#0f8b8d] text-white border-[#0f8b8d] font-bold'
                              : 'bg-[#0f1419] text-slate-400 border-[#2f3b47] hover:border-slate-500'
                          }`}
                        >
                          {r}:1
                        </button>
                      ))}
                    </div>
                  )}

                  {charConfig.type === 'BI_LINEAR' && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                      <span>Knee:</span>
                      <span className="text-[#ffd77a]">{charConfig.biLinearKneeTravelPct}% travel</span>
                      <span className="text-slate-500">/</span>
                      <span className="text-[#7fe0e2]">{charConfig.biLinearKneeCvPct}% Cv</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => setActiveTab('CHARACTERISTICS')}
                    className="text-[#7fe0e2] hover:underline text-[11px] flex items-center gap-1 shrink-0"
                    title="Open full characteristic editor, installed gain & authority curve in Tab 2"
                  >
                    Full Curve & Authority →
                  </button>
                </div>
              </div>

              <div className="p-5 overflow-x-auto">
                {(() => {
                  const renderParamLabel = (
                    label: string,
                    infoText: string,
                    placement: 'bottom' | 'top' = 'bottom',
                    align: 'left' | 'right' = 'left'
                  ) => (
                    <div className="flex items-center justify-between gap-2">
                      <span>{label}</span>
                      <span className="relative group inline-flex items-center shrink-0">
                        <button
                          type="button"
                          aria-label={`${label}: ${infoText}`}
                          className="p-0.5 rounded-full text-[#0f8b8d] hover:bg-[#0f8b8d]/15 focus:outline-none focus:ring-1 focus:ring-[#0f8b8d] transition"
                        >
                          <Info className="w-3.5 h-3.5" />
                        </button>
                        <span
                          role="tooltip"
                          className={`hidden group-hover:block group-focus-within:block absolute ${
                            align === 'right' ? 'right-0' : 'left-0'
                          } ${
                            placement === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                          } z-50 w-64 p-2.5 rounded-lg bg-[#0f1419] text-slate-200 border border-[#2f3b47] shadow-2xl text-[11px] font-sans font-normal leading-snug whitespace-normal pointer-events-none`}
                        >
                          {infoText}
                        </span>
                      </span>
                    </div>
                  );

                  return (
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="border-b border-[#cfd8e3] text-[#13315c] bg-[#edf1f5]">
                          <th className="py-2.5 px-3 sticky left-0 z-20 hover:z-30 focus-within:z-30 bg-[#edf1f5] min-w-[230px] border-r border-[#cfd8e3]">
                            {renderParamLabel(
                              'Parameter / Operating Case',
                              'Each column represents a process operating condition (e.g. Min, Normal, Max, Start-Up, Upset). Edit the case name or remove extra cases.'
                            )}
                          </th>
                          {operatingCases.map((c, idx) => (
                            <th key={c.id} className="py-2 px-2.5 min-w-[145px]">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={c.label}
                                  onChange={(e) => {
                                    const next = [...operatingCases];
                                    next[idx].label = e.target.value;
                                    setOperatingCases(next);
                                  }}
                                  className="bg-white border border-[#cfd8e3] rounded px-2 py-1 w-full text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
                                  aria-label={`Case ${idx + 1} Name`}
                                />
                                {operatingCases.length > 1 && (
                                  <button
                                    onClick={() =>
                                      setOperatingCases(operatingCases.filter((item) => item.id !== c.id))
                                    }
                                    className="p-1 text-slate-400 hover:text-red-600 transition shrink-0"
                                    title={`Remove ${c.label}`}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e2e8f0]">
                        <tr className="hover:bg-[#f8fafc]">
                          <th className="py-2 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                            {renderParamLabel(
                              'Phase',
                              'Fluid state at the valve inlet: LIQUID (IEC 60534-2-1), GAS (compressible), STEAM (IAPWS saturation/superheat), or TWO_PHASE (separated/homogeneous flashing mixture).'
                            )}
                          </th>
                          {operatingCases.map((c, idx) => (
                            <td key={c.id} className="py-2 px-2.5">
                              <select
                                value={c.fluidPhase}
                                onChange={(e) => {
                                  const next = [...operatingCases];
                                  next[idx].fluidPhase = e.target.value as any;
                                  setOperatingCases(next);
                                }}
                                className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                              >
                                <option value="LIQUID">LIQUID</option>
                                <option value="GAS">GAS</option>
                                <option value="STEAM">STEAM</option>
                                <option value="TWO_PHASE">TWO_PHASE</option>
                              </select>
                            </td>
                          ))}
                        </tr>

                        <tr className="hover:bg-[#f8fafc]">
                          <th className="py-2 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                            <div className="flex items-center justify-between gap-2">
                              <span>Flow ({processUnits.flowRate === 'm3_h' ? 'm³/h' : processUnits.flowRate === 'gpm' ? 'gpm' : processUnits.flowRate === 'Nm3_h' ? 'Nm³/h' : processUnits.flowRate === 'scfh' ? 'SCFH' : processUnits.flowRate === 'scfm' ? 'SCFM' : processUnits.flowRate === 'lb_h' ? 'lb/h' : 'kg/h'})</span>
                              <div className="flex items-center gap-1">
                                <select
                                  value={processUnits.flowRate}
                                  onChange={(e) => setProcessUnits({ ...processUnits, flowRate: e.target.value as FlowUnit })}
                                  className="bg-[#edf1f5] border border-[#cfd8e3] text-[#0f8b8d] font-bold rounded px-1.5 py-0.5 text-[10px] focus:outline-none"
                                  title="Change Flow Rate display unit with auto-conversion"
                                >
                                  <optgroup label="Liquid / Volumetric">
                                    <option value="m3_h">m³/h</option>
                                    <option value="gpm">gpm (US)</option>
                                  </optgroup>
                                  <optgroup label="Gas / Standard Volumetric">
                                    <option value="Nm3_h">Nm³/h</option>
                                    <option value="scfh">SCFH</option>
                                    <option value="scfm">SCFM</option>
                                  </optgroup>
                                  <optgroup label="Mass Flow">
                                    <option value="kg_h">kg/h</option>
                                    <option value="lb_h">lb/h</option>
                                  </optgroup>
                                </select>
                                <span className="relative group inline-flex items-center shrink-0">
                                  <button
                                    type="button"
                                    aria-label="Flow info"
                                    className="p-0.5 rounded-full text-[#0f8b8d] hover:bg-[#0f8b8d]/15 focus:outline-none focus:ring-1 focus:ring-[#0f8b8d] transition"
                                  >
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                  <span
                                    role="tooltip"
                                    className="hidden group-hover:block group-focus-within:block absolute right-0 top-full mt-1.5 z-50 w-64 p-2.5 rounded-lg bg-[#0f1419] text-slate-200 border border-[#2f3b47] shadow-2xl text-[11px] font-sans font-normal leading-snug whitespace-normal pointer-events-none"
                                  >
                                    Process flow rate: volumetric flow in m³/h or gpm for Liquid, standard volumetric flow in Nm³/h or SCFH/SCFM for Gas, or mass flow in kg/h or lb/h for Steam. Automatically converted when switching units.
                                  </span>
                                </span>
                              </div>
                            </div>
                          </th>
                          {operatingCases.map((c, idx) => {
                            const displayFlow = Number(fromInternalFlow(c.flowRate, processUnits.flowRate, c.fluidPhase).toFixed(2));
                            return (
                              <td key={c.id} className="py-2 px-2.5">
                                <input
                                  type="number"
                                  step="any"
                                  value={displayFlow}
                                  onChange={(e) => {
                                    const next = [...operatingCases];
                                    const val = Number(e.target.value);
                                    next[idx].flowRate = Number(toInternalFlow(val, processUnits.flowRate, c.fluidPhase).toFixed(4));
                                    setOperatingCases(next);
                                  }}
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                                />
                              </td>
                            );
                          })}
                        </tr>

                        <tr className="hover:bg-[#f8fafc]">
                          <th className="py-2 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                            <div className="flex items-center justify-between gap-2">
                              <span>P1 ({processUnits.P1})</span>
                              <div className="flex items-center gap-1">
                                <select
                                  value={processUnits.P1}
                                  onChange={(e) => setProcessUnits({ ...processUnits, P1: e.target.value as PressureUnit })}
                                  className="bg-[#edf1f5] border border-[#cfd8e3] text-[#0f8b8d] font-bold rounded px-1.5 py-0.5 text-[10px] focus:outline-none"
                                  title="Change P1 display unit with auto-conversion"
                                >
                                  <option value="bar_a">bar a</option>
                                  <option value="psia">psia</option>
                                  <option value="kPa_a">kPa a</option>
                                  <option value="bar_g">bar g</option>
                                  <option value="psig">psig</option>
                                </select>
                                <span className="relative group inline-flex items-center shrink-0">
                                  <button
                                    type="button"
                                    aria-label="P1 info"
                                    className="p-0.5 rounded-full text-[#0f8b8d] hover:bg-[#0f8b8d]/15 focus:outline-none focus:ring-1 focus:ring-[#0f8b8d] transition"
                                  >
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                  <span
                                    role="tooltip"
                                    className="hidden group-hover:block group-focus-within:block absolute right-0 top-full mt-1.5 z-50 w-64 p-2.5 rounded-lg bg-[#0f1419] text-slate-200 border border-[#2f3b47] shadow-2xl text-[11px] font-sans font-normal leading-snug whitespace-normal pointer-events-none"
                                  >
                                    Upstream absolute inlet pressure at the valve inlet flange. Used to compute ΔP, choked pressure drop, and gas expansion factor Y.
                                  </span>
                                </span>
                              </div>
                            </div>
                          </th>
                          {operatingCases.map((c, idx) => {
                            const displayP1 = Number(fromInternalPressure(c.P1_bar_a, processUnits.P1).toFixed(2));
                            return (
                              <td key={c.id} className="py-2 px-2.5">
                                <input
                                  type="number"
                                  step="any"
                                  value={displayP1}
                                  onChange={(e) => {
                                    const next = [...operatingCases];
                                    const val = Number(e.target.value);
                                    next[idx].P1_bar_a = Number(toInternalPressure(val, processUnits.P1).toFixed(4));
                                    setOperatingCases(next);
                                  }}
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                                />
                              </td>
                            );
                          })}
                        </tr>

                        <tr className="hover:bg-[#f8fafc]">
                          <th className="py-2 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                            <div className="flex items-center justify-between gap-2">
                              <span>P2 ({processUnits.P2})</span>
                              <div className="flex items-center gap-1">
                                <select
                                  value={processUnits.P2}
                                  onChange={(e) => setProcessUnits({ ...processUnits, P2: e.target.value as PressureUnit })}
                                  className="bg-[#edf1f5] border border-[#cfd8e3] text-[#0f8b8d] font-bold rounded px-1.5 py-0.5 text-[10px] focus:outline-none"
                                  title="Change P2 display unit with auto-conversion"
                                >
                                  <option value="bar_a">bar a</option>
                                  <option value="psia">psia</option>
                                  <option value="kPa_a">kPa a</option>
                                  <option value="bar_g">bar g</option>
                                  <option value="psig">psig</option>
                                </select>
                                <span className="relative group inline-flex items-center shrink-0">
                                  <button
                                    type="button"
                                    aria-label="P2 info"
                                    className="p-0.5 rounded-full text-[#0f8b8d] hover:bg-[#0f8b8d]/15 focus:outline-none focus:ring-1 focus:ring-[#0f8b8d] transition"
                                  >
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                  <span
                                    role="tooltip"
                                    className="hidden group-hover:block group-focus-within:block absolute right-0 top-full mt-1.5 z-50 w-64 p-2.5 rounded-lg bg-[#0f1419] text-slate-200 border border-[#2f3b47] shadow-2xl text-[11px] font-sans font-normal leading-snug whitespace-normal pointer-events-none"
                                  >
                                    Downstream absolute outlet pressure at the valve outlet flange. ΔP = P1 − P2; also drives cavitation index σ and flashing checks.
                                  </span>
                                </span>
                              </div>
                            </div>
                          </th>
                          {operatingCases.map((c, idx) => {
                            const displayP2 = Number(fromInternalPressure(c.P2_bar_a, processUnits.P2).toFixed(2));
                            return (
                              <td key={c.id} className="py-2 px-2.5">
                                <input
                                  type="number"
                                  step="any"
                                  value={displayP2}
                                  onChange={(e) => {
                                    const next = [...operatingCases];
                                    const val = Number(e.target.value);
                                    next[idx].P2_bar_a = Number(toInternalPressure(val, processUnits.P2).toFixed(4));
                                    setOperatingCases(next);
                                  }}
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                                />
                              </td>
                            );
                          })}
                        </tr>

                        <tr className="hover:bg-[#f8fafc]">
                          <th className="py-2 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                            <div className="flex items-center justify-between gap-2">
                              <span>T1 ({processUnits.T1 === 'degC' ? '°C' : processUnits.T1 === 'degF' ? '°F' : processUnits.T1 === 'K' ? 'K' : '°R'})</span>
                              <div className="flex items-center gap-1">
                                <select
                                  value={processUnits.T1}
                                  onChange={(e) => setProcessUnits({ ...processUnits, T1: e.target.value as TemperatureUnit })}
                                  className="bg-[#edf1f5] border border-[#cfd8e3] text-[#0f8b8d] font-bold rounded px-1.5 py-0.5 text-[10px] focus:outline-none"
                                  title="Change Temperature display unit with auto-conversion"
                                >
                                  <option value="degC">°C</option>
                                  <option value="degF">°F</option>
                                  <option value="K">K</option>
                                  <option value="degR">°R</option>
                                </select>
                                <span className="relative group inline-flex items-center shrink-0">
                                  <button
                                    type="button"
                                    aria-label="T1 info"
                                    className="p-0.5 rounded-full text-[#0f8b8d] hover:bg-[#0f8b8d]/15 focus:outline-none focus:ring-1 focus:ring-[#0f8b8d] transition"
                                  >
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                  <span
                                    role="tooltip"
                                    className="hidden group-hover:block group-focus-within:block absolute right-0 top-full mt-1.5 z-50 w-64 p-2.5 rounded-lg bg-[#0f1419] text-slate-200 border border-[#2f3b47] shadow-2xl text-[11px] font-sans font-normal leading-snug whitespace-normal pointer-events-none"
                                  >
                                    Upstream flowing fluid temperature. Used for ASME B16.34 pressure-temperature rating, gas density, sonic velocity, and thermal expansion.
                                  </span>
                                </span>
                              </div>
                            </div>
                          </th>
                          {operatingCases.map((c, idx) => {
                            const displayT1 = Number(fromInternalTemperature(c.T1_degC, processUnits.T1).toFixed(1));
                            return (
                              <td key={c.id} className="py-2 px-2.5">
                                <input
                                  type="number"
                                  step="any"
                                  value={displayT1}
                                  onChange={(e) => {
                                    const next = [...operatingCases];
                                    const val = Number(e.target.value);
                                    next[idx].T1_degC = Number(toInternalTemperature(val, processUnits.T1).toFixed(2));
                                    setOperatingCases(next);
                                  }}
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                                />
                              </td>
                            );
                          })}
                        </tr>

                        <tr className="hover:bg-[#f8fafc]">
                          <th className="py-2 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                            <div className="flex items-center justify-between gap-2">
                              <span>ρ ({processUnits.density === 'kg_m3' ? 'kg/m³' : processUnits.density === 'lb_ft3' ? 'lb/ft³' : 'SG'}) / MW</span>
                              <div className="flex items-center gap-1">
                                <select
                                  value={processUnits.density}
                                  onChange={(e) => setProcessUnits({ ...processUnits, density: e.target.value as DensityUnit })}
                                  className="bg-[#edf1f5] border border-[#cfd8e3] text-[#0f8b8d] font-bold rounded px-1.5 py-0.5 text-[10px] focus:outline-none"
                                  title="Change Liquid Density display unit with auto-conversion"
                                >
                                  <option value="kg_m3">kg/m³</option>
                                  <option value="lb_ft3">lb/ft³</option>
                                  <option value="sg">SG (rel water)</option>
                                </select>
                                <span className="relative group inline-flex items-center shrink-0">
                                  <button
                                    type="button"
                                    aria-label="Density/MW info"
                                    className="p-0.5 rounded-full text-[#0f8b8d] hover:bg-[#0f8b8d]/15 focus:outline-none focus:ring-1 focus:ring-[#0f8b8d] transition"
                                  >
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                  <span
                                    role="tooltip"
                                    className="hidden group-hover:block group-focus-within:block absolute right-0 bottom-full mb-1.5 z-50 w-64 p-2.5 rounded-lg bg-[#0f1419] text-slate-200 border border-[#2f3b47] shadow-2xl text-[11px] font-sans font-normal leading-snug whitespace-normal pointer-events-none"
                                  >
                                    For Liquid: flowing density ρ in kg/m³, lb/ft³, or Specific Gravity (SG). For Gas/Steam: molecular weight MW in kg/kmol (g/mol).
                                  </span>
                                </span>
                              </div>
                            </div>
                          </th>
                          {operatingCases.map((c, idx) => (
                            <td key={c.id} className="py-2 px-2.5">
                              {c.fluidPhase === 'LIQUID' ? (
                                <input
                                  type="number"
                                  step="any"
                                  value={Number(fromInternalDensity(c.rho_kg_m3, processUnits.density).toFixed(2))}
                                  onChange={(e) => {
                                    const next = [...operatingCases];
                                    const val = Number(e.target.value);
                                    next[idx].rho_kg_m3 = Number(toInternalDensity(val, processUnits.density).toFixed(2));
                                    setOperatingCases(next);
                                  }}
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                                  title={`Liquid Density (${processUnits.density})`}
                                />
                              ) : (
                                <input
                                  type="number"
                                  step="0.1"
                                  value={c.molecularWeight}
                                  onChange={(e) => {
                                    const next = [...operatingCases];
                                    next[idx].molecularWeight = Number(e.target.value);
                                    setOperatingCases(next);
                                  }}
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                                  title="Molecular Weight (kg/kmol)"
                                />
                              )}
                            </td>
                          ))}
                        </tr>

                        <tr className="hover:bg-[#f8fafc]">
                          <th className="py-2 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                            <div className="flex items-center justify-between gap-2">
                              <span>Pv ({processUnits.Pv}) / γ</span>
                              <div className="flex items-center gap-1">
                                <select
                                  value={processUnits.Pv}
                                  onChange={(e) => setProcessUnits({ ...processUnits, Pv: e.target.value as PressureUnit })}
                                  className="bg-[#edf1f5] border border-[#cfd8e3] text-[#0f8b8d] font-bold rounded px-1.5 py-0.5 text-[10px] focus:outline-none"
                                  title="Change Vapor Pressure display unit with auto-conversion"
                                >
                                  <option value="bar_a">bar a</option>
                                  <option value="psia">psia</option>
                                  <option value="kPa_a">kPa a</option>
                                </select>
                                <span className="relative group inline-flex items-center shrink-0">
                                  <button
                                    type="button"
                                    aria-label="Pv/gamma info"
                                    className="p-0.5 rounded-full text-[#0f8b8d] hover:bg-[#0f8b8d]/15 focus:outline-none focus:ring-1 focus:ring-[#0f8b8d] transition"
                                  >
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                  <span
                                    role="tooltip"
                                    className="hidden group-hover:block group-focus-within:block absolute right-0 bottom-full mb-1.5 z-50 w-64 p-2.5 rounded-lg bg-[#0f1419] text-slate-200 border border-[#2f3b47] shadow-2xl text-[11px] font-sans font-normal leading-snug whitespace-normal pointer-events-none"
                                  >
                                    For Liquid: fluid vapor pressure Pv at T1 (governs choked ΔP and cavitation/flashing). For Gas/Steam: specific heat ratio γ = Cp/Cv.
                                  </span>
                                </span>
                              </div>
                            </div>
                          </th>
                          {operatingCases.map((c, idx) => (
                            <td key={c.id} className="py-2 px-2.5">
                              {c.fluidPhase === 'LIQUID' ? (
                                <input
                                  type="number"
                                  step="any"
                                  value={Number(fromInternalPressure(c.Pv_bar_a, processUnits.Pv).toFixed(3))}
                                  onChange={(e) => {
                                    const next = [...operatingCases];
                                    const val = Number(e.target.value);
                                    next[idx].Pv_bar_a = Number(toInternalPressure(val, processUnits.Pv).toFixed(4));
                                    setOperatingCases(next);
                                  }}
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                                  title={`Vapor Pressure Pv (${processUnits.Pv})`}
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
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                                  title="Specific Heat Ratio Cp/Cv"
                                />
                              )}
                            </td>
                          ))}
                        </tr>

                        <tr className="hover:bg-[#f8fafc]">
                          <th className="py-2 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                            <div className="flex items-center justify-between gap-2">
                              <span>ν ({processUnits.viscosity}) / Z</span>
                              <div className="flex items-center gap-1">
                                <select
                                  value={processUnits.viscosity}
                                  onChange={(e) => setProcessUnits({ ...processUnits, viscosity: e.target.value as ViscosityUnit })}
                                  className="bg-[#edf1f5] border border-[#cfd8e3] text-[#0f8b8d] font-bold rounded px-1.5 py-0.5 text-[10px] focus:outline-none"
                                  title="Change Viscosity display unit with auto-conversion"
                                >
                                  <option value="cSt">cSt (mm²/s)</option>
                                  <option value="SSU">SSU</option>
                                  <option value="cP">cP</option>
                                </select>
                                <span className="relative group inline-flex items-center shrink-0">
                                  <button
                                    type="button"
                                    aria-label="Viscosity/Z info"
                                    className="p-0.5 rounded-full text-[#0f8b8d] hover:bg-[#0f8b8d]/15 focus:outline-none focus:ring-1 focus:ring-[#0f8b8d] transition"
                                  >
                                    <Info className="w-3.5 h-3.5" />
                                  </button>
                                  <span
                                    role="tooltip"
                                    className="hidden group-hover:block group-focus-within:block absolute right-0 bottom-full mb-1.5 z-50 w-64 p-2.5 rounded-lg bg-[#0f1419] text-slate-200 border border-[#2f3b47] shadow-2xl text-[11px] font-sans font-normal leading-snug whitespace-normal pointer-events-none"
                                  >
                                    For Liquid: kinematic viscosity ν (used for IEC 60534-2-1 Reynolds correction F_R). For Gas/Steam: compressibility factor Z.
                                  </span>
                                </span>
                              </div>
                            </div>
                          </th>
                          {operatingCases.map((c, idx) => (
                            <td key={c.id} className="py-2 px-2.5">
                              {c.fluidPhase === 'LIQUID' ? (
                                <input
                                  type="number"
                                  step="any"
                                  value={Number(fromInternalViscosity(c.viscosity_cSt, processUnits.viscosity).toFixed(2))}
                                  onChange={(e) => {
                                    const next = [...operatingCases];
                                    const val = Number(e.target.value);
                                    next[idx].viscosity_cSt = Number(toInternalViscosity(val, processUnits.viscosity).toFixed(3));
                                    setOperatingCases(next);
                                  }}
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                                  title={`Kinematic Viscosity (${processUnits.viscosity})`}
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
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                                  title="Compressibility Factor Z"
                                />
                              )}
                            </td>
                          ))}
                        </tr>

                        {operatingCases.some((c) => c.fluidPhase === 'TWO_PHASE') && (
                          <tr className="hover:bg-[#f8fafc]">
                            <th className="py-2 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                              {renderParamLabel(
                                'Gas/Vapor Mass Frac fg',
                                'Inlet gas/vapor mass quality fg (0 to 1) for TWO_PHASE sizing. Uses separated flow model for fg < 0.05 or homogeneous Ve model for fg >= 0.05.',
                                'top'
                              )}
                            </th>
                            {operatingCases.map((c, idx) => (
                              <td key={c.id} className="py-2 px-2.5">
                                {c.fluidPhase === 'TWO_PHASE' ? (
                                  <input
                                    type="number"
                                    min="0.001"
                                    max="0.99"
                                    step="0.01"
                                    value={c.massFractionGas_fg ?? 0.15}
                                    onChange={(e) => {
                                      const next = [...operatingCases];
                                      next[idx].massFractionGas_fg = Math.min(
                                        0.99,
                                        Math.max(0.001, Number(e.target.value))
                                      );
                                      setOperatingCases(next);
                                    }}
                                    className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                                    title="Gas/Vapor Mass Fraction fg (0.001–0.99)"
                                  />
                                ) : (
                                  <span className="text-slate-400 text-[11px]">—</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        )}

                        {/* LIVE CALCULATED OUTPUT ROWS (DARK INSTRUMENT TELEMETRY) */}
                        <tr className="bg-[#0f1419] text-slate-200 border-t-2 border-[#2f3b47]">
                          <th className="py-2.5 px-3 font-semibold text-[#ffd77a] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-[#0f1419] border-r border-[#2f3b47]">
                            {renderParamLabel(
                              'Calculated Req. Cv',
                              'Required IEC 60534-2-1 flow coefficient (Cv / Kv) for this operating condition, auto-recalculated when valve size, piping, or trim changes.',
                              'top'
                            )}
                          </th>
                          {operatingCases.map((c) => {
                            const res = caseResults.find((r) => r.id === c.id);
                            return (
                              <td
                                key={c.id}
                                className="py-2.5 px-2.5 bg-[#182028] border-l border-[#2f3b47]"
                              >
                                {res ? (
                                  <div className="flex items-baseline justify-between gap-1">
                                    <span className="font-bold text-[#7fe0e2]">
                                      {res.requiredCv} Cv
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      ({res.requiredKv} Kv)
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        <tr className="bg-[#0f1419] text-slate-200 border-t border-[#2f3b47]">
                          <th className="py-2.5 px-3 font-semibold text-[#8be0a8] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-[#0f1419] border-r border-[#2f3b47]">
                            {renderParamLabel(
                              'Valve % Open (Travel)',
                              'Predicted valve plug travel (% open) based on the active valve size, rated Cv, trim style, and flow characteristic curve.',
                              'top'
                            )}
                          </th>
                          {operatingCases.map((c) => {
                            const res = caseResults.find((r) => r.id === c.id);
                            const travel = res?.estimatedTravelPct ?? 0;
                            const travelColor = !res
                              ? 'text-slate-500'
                              : travel >= 99 || res.percentOfRatedCv > 90
                              ? 'text-[#ff8a80]'
                              : travel < 15 || travel > 85
                              ? 'text-[#ffd77a]'
                              : 'text-[#8be0a8]';
                            return (
                              <td
                                key={c.id}
                                className="py-2.5 px-2.5 bg-[#182028] border-l border-[#2f3b47]"
                              >
                                {res ? (
                                  <div className="flex items-baseline justify-between gap-1">
                                    <span className={`font-bold ${travelColor}`}>
                                      {res.estimatedTravelPct}%
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      ({res.percentOfRatedCv}% Cv)
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        <tr className="bg-[#0f1419] text-slate-200 border-t border-[#2f3b47]">
                          <th className="py-2.5 px-3 font-semibold text-[#7fe0e2] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-[#0f1419] border-r border-[#2f3b47]">
                            {renderParamLabel(
                              'Req. FL / Effective FL(h)',
                              'Warren VSSTR-07 Required FL = sqrt(dP/(P1-FF*Pv)) vs stroke-dependent valve recovery FL(h) and xT(h) at predicted plug travel.',
                              'top'
                            )}
                          </th>
                          {operatingCases.map((c) => {
                            const res = caseResults.find((r) => r.id === c.id);
                            const flWarn =
                              res && res.fluidPhase === 'LIQUID' && res.FL_required > res.FL_effectiveAtTravel;
                            return (
                              <td
                                key={c.id}
                                className="py-2.5 px-2.5 bg-[#182028] border-l border-[#2f3b47]"
                              >
                                {res ? (
                                  <div className="flex flex-col gap-0.5 text-[11px]">
                                    <div className="flex items-baseline justify-between gap-1">
                                      <span className={flWarn ? 'font-bold text-[#ffd77a]' : 'font-bold text-[#8be0a8]'}>
                                        {res.fluidPhase === 'LIQUID'
                                          ? `Req ${res.FL_required}`
                                          : res.twoPhaseModelUsed
                                          ? '2Φ Mix'
                                          : `xT ${res.xT_effectiveAtTravel}`}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        {res.fluidPhase === 'LIQUID'
                                          ? `FL(h)=${res.FL_effectiveAtTravel}`
                                          : res.steamSuperheat_degC !== undefined
                                          ? `ΔTsup ${res.steamSuperheat_degC}°C`
                                          : `FM ${res.multistageFactorFM}`}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        <tr className="bg-[#0f1419] text-slate-200 border-t border-[#2f3b47]">
                          <th className="py-2.5 px-3 font-semibold text-[#ffd77a] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-[#0f1419] border-r border-[#2f3b47]">
                            {renderParamLabel(
                              'ISA-RP75.23 σ / σ_mr & OSHA',
                              'Service cavitation index σ vs ISA-RP75.23 max recommended damage limit σ_mr (with material hardness resistance index), plus OSHA/NIOSH acoustic shift.',
                              'top'
                            )}
                          </th>
                          {operatingCases.map((c) => {
                            const res = caseResults.find((r) => r.id === c.id);
                            const sigmaColor = !res
                              ? 'text-slate-500'
                              : res.fluidPhase !== 'LIQUID'
                              ? 'text-[#7fe0e2]'
                              : res.sigmaCavitation < res.sigmaConstant_c
                              ? 'text-[#ff8a80]'
                              : res.sigmaCavitation < res.sigmaRecommended_mr
                              ? 'text-[#ffd77a]'
                              : 'text-[#8be0a8]';
                            return (
                              <td
                                key={c.id}
                                className="py-2.5 px-2.5 bg-[#182028] border-l border-[#2f3b47]"
                              >
                                {res ? (
                                  <div className="flex flex-col gap-0.5 text-[11px]">
                                    <div className="flex items-baseline justify-between gap-1">
                                      <span className={`font-bold ${sigmaColor}`}>
                                        {res.fluidPhase === 'LIQUID'
                                          ? `σ=${res.sigmaCavitation}`
                                          : `FM=${res.multistageFactorFM}`}
                                      </span>
                                      <span className="text-[10px] text-slate-400">
                                        {res.fluidPhase === 'LIQUID'
                                          ? `σ_mr=${res.sigmaRecommended_mr}`
                                          : `SPLe ${res.expanderNoise_dBA}dB`}
                                      </span>
                                    </div>
                                    <span className="text-[9px] text-slate-400 truncate">
                                      {res.oshaNioshExposureSummary}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>

            {/* IEC 60534 SIZING, CAVITATION, VELOCITY & ACOUSTIC NOISE DIAGNOSTIC MATRIX */}
            <div className="dy-card overflow-hidden">
              <div className="section-band px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-[#ffd77a]" />
                    IEC 60534-2-1 & 60534-8-3/8-4 Sizing, Cavitation, Velocity & Acoustic Noise Results
                  </h2>
                  <p className="text-xs text-slate-300 font-mono">
                    Includes coupled reducer/expander factors (FP, FLP, xTP), Strouhal ultrasonic frequency shift (fp), and Joukowsky surge
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
                  <span className="px-2.5 py-1 rounded bg-[#182028] border border-[#2f3b47] text-slate-300">
                    Pipe Coinc. f_o: <strong className="text-[#8be0a8]">{caseResults[0]?.coincidenceFreq_Hz || 2600} Hz</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded bg-[#182028] border border-[#2f3b47] text-slate-300">
                    Pipe Ring f_r: <strong className="text-[#7fe0e2]">{caseResults[0]?.ringFreq_Hz || 15000} Hz</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded bg-[#182028] border border-[#2f3b47] text-slate-300">
                    Mean Cage Orifice Ød_h: <strong className="text-[#ffd77a]">{cageSynthesis.meanHoleDia_mm} mm</strong>
                  </span>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#cfd8e3] text-[#13315c] bg-[#edf1f5]">
                        <th className="py-2.5 px-3 sticky left-0 z-20 hover:z-30 focus-within:z-30 bg-[#edf1f5] min-w-[200px] border-r border-[#cfd8e3]">
                          Result Parameter
                        </th>
                        {caseResults.map((r) => (
                          <th key={r.id} className="py-2.5 px-3 font-bold text-[#0b2545] min-w-[150px]">
                            {r.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0]">
                      <tr className="hover:bg-[#f8fafc]">
                        <th className="py-2.5 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                          ΔP / ΔP_choked (bar)
                        </th>
                        {caseResults.map((r) => (
                          <td key={r.id} className="py-2.5 px-3">
                            <span className="text-[#0b2545] font-semibold">{r.deltaP_bar}</span> /{' '}
                            <span className="text-slate-500">{r.deltaP_choked_bar}</span>
                            {r.isChoked && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#182028] text-[#ffd77a] border border-[#2f3b47] text-[10px]">
                                CHOKED
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-[#f8fafc]">
                        <th className="py-2.5 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                          FP / FLP
                        </th>
                        {caseResults.map((r) => (
                          <td key={r.id} className="py-2.5 px-3 text-slate-700">
                            {r.FP} / {r.FLP}
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-[#f8fafc]">
                        <th className="py-2.5 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                          Re_v (F_R)
                        </th>
                        {caseResults.map((r) => (
                          <td key={r.id} className="py-2.5 px-3 text-slate-700">
                            {r.Rev.toLocaleString()} ({r.FR})
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-[#f8fafc]">
                        <th className="py-2.5 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                          Req Cv (Kv)
                        </th>
                        {caseResults.map((r) => (
                          <td key={r.id} className="py-2.5 px-3 font-bold text-[#0f8b8d]">
                            {r.requiredCv} <span className="text-slate-500 font-normal">({r.requiredKv})</span>
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-[#f8fafc]">
                        <th className="py-2.5 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                          % Rated Cv
                        </th>
                        {caseResults.map((r) => {
                          const cvOver85 = r.percentOfRatedCv > 85;
                          const cvUnder10 = r.percentOfRatedCv < 10;
                          return (
                            <td key={r.id} className="py-2.5 px-3">
                              <span
                                className={`font-bold ${
                                  cvOver85
                                    ? 'text-red-600'
                                    : cvUnder10
                                    ? 'text-amber-600'
                                    : 'text-emerald-700'
                                }`}
                              >
                                {r.percentOfRatedCv}%
                              </span>
                            </td>
                          );
                        })}
                      </tr>

                      <tr className="hover:bg-[#f8fafc]">
                        <th className="py-2.5 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                          Travel %
                        </th>
                        {caseResults.map((r) => (
                          <td key={r.id} className="py-2.5 px-3 font-semibold text-[#0b2545]">
                            {r.estimatedTravelPct}%
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-[#f8fafc]">
                        <th className="py-2.5 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                          Cavitation σ / xFZ / Kc
                        </th>
                        {caseResults.map((r) => (
                          <td key={r.id} className="py-2.5 px-3 text-slate-700">
                            {r.fluidPhase === 'LIQUID'
                              ? `σ=${r.sigmaCavitation} | ${r.xFZ} | ${r.Kc_effective}`
                              : `xTP=${r.xTP}`}
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-[#f8fafc]">
                        <th className="py-2.5 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                          Regime Classification
                        </th>
                        {caseResults.map((r) => (
                          <td key={r.id} className="py-2.5 px-3">
                            {renderStatusBadge(r.regimeSeverity, r.regimeLabel)}
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-[#f8fafc]">
                        <th className="py-2.5 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                          Body Vel / Mach
                        </th>
                        {caseResults.map((r) => (
                          <td key={r.id} className="py-2.5 px-3">
                            <span
                              className={
                                r.bodyVelocity_m_s > r.bodyVelocityLimit_m_s ||
                                r.outletMach > r.outletMachLimit
                                  ? 'text-red-600 font-bold'
                                  : 'text-[#0b2545]'
                              }
                            >
                              {r.bodyVelocity_m_s} m/s (M={r.outletMach})
                            </span>
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-[#f8fafc]">
                        <th className="py-2.5 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                          Strouhal f_p (Hz)
                        </th>
                        {caseResults.map((r) => (
                          <td key={r.id} className="py-2.5 px-3 text-[#0f8b8d] font-semibold">
                            {r.strouhalPeakFreq_Hz.toLocaleString()} Hz
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-[#f8fafc]">
                        <th className="py-2.5 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                          Noise Std → Drilled (dBA)
                        </th>
                        {caseResults.map((r) => (
                          <td key={r.id} className="py-2.5 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-slate-400 line-through">
                                {r.noiseStandardTrim_dBA}
                              </span>
                              <span className="text-slate-400">→</span>
                              <span
                                className={`font-bold ${
                                  r.noiseStatus === 'PASS'
                                    ? 'text-emerald-700'
                                    : r.noiseStatus === 'WARNING'
                                    ? 'text-amber-600'
                                    : 'text-red-600'
                                }`}
                              >
                                {r.noiseDrilledCage_dBA} dBA
                              </span>
                              <span className="text-[10px] text-[#0f8b8d] font-semibold">
                                (-{r.noiseAttenuation_dBA} dB)
                              </span>
                            </div>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Water-Hammer, Thiruvengadam Erosion, Coincidence/Expander & Low-Freq Pulsation Telemetry */}
                {caseResults.length > 0 && (
                  <div className="instrument-panel rounded-xl p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="instrument-tile rounded-lg p-3.5 text-xs font-mono">
                      <span className="text-slate-400 block uppercase text-[10px] mb-1">
                        Joukowsky Surge & Thiruvengadam Endurance
                      </span>
                      {caseResults.some((r) => r.fluidPhase === 'LIQUID') ? (
                        <p className="text-slate-200">
                          Peak Surge:{' '}
                          <strong className="text-[#ffd77a]">
                            +{Math.max(...caseResults.map((c) => c.joukowskySurge_bar))} bar
                          </strong>{' '}
                          (t_safe ≥{' '}
                          <strong className="text-[#7fe0e2]">
                            {caseResults[0]?.minSafeCloseTime_s} s
                          </strong>
                          ). Implosion P_wh ={' '}
                          <strong
                            className={
                              Math.max(...caseResults.map((c) => c.thiruvengadamErosionRatioPct)) >= 100
                                ? 'text-[#ff8a80]'
                                : 'text-[#8be0a8]'
                            }
                          >
                            {Math.max(...caseResults.map((c) => c.waterHammerSurfacePressure_MPa))} MPa
                          </strong>{' '}
                          vs σ_1/3 = {caseResults[0]?.thiruvengadamEnduranceLimit_MPa} MPa (
                          {Math.max(...caseResults.map((c) => c.thiruvengadamErosionRatioPct))}%).
                        </p>
                      ) : (
                        <p className="text-slate-200">
                          Compressible/Two-Phase Service: Joukowsky surge N/A. Active model:{' '}
                          <strong className="text-[#7fe0e2]">
                            {caseResults[0]?.twoPhaseModelUsed ||
                              (caseResults[0]?.steamSuperheat_degC !== undefined
                                ? `IAPWS Steam ΔTsup = ${caseResults[0].steamSuperheat_degC}°C (F_SH=${caseResults[0].steamSuperheatFactorFSH})`
                                : 'IEC 60534-2-1 Compressible')}
                          </strong>
                          .
                        </p>
                      )}
                    </div>
                    <div className="instrument-tile rounded-lg p-3.5 text-xs font-mono">
                      <span className="text-slate-400 block uppercase text-[10px] mb-1">
                        IEC 60534-8-3 Shift, Coincidence f_o & Expander SPL_E
                      </span>
                      <p className="text-slate-200">
                        <strong className="text-[#7fe0e2]">{cageSynthesis.totalHoles} orifices</strong>{' '}
                        (Ø{cageSynthesis.meanHoleDia_mm} mm) shift f_p to{' '}
                        <strong className="text-[#ffd77a]">
                          {caseResults[0]?.strouhalPeakFreq_Hz.toLocaleString()} Hz
                        </strong>{' '}
                        vs pipe coincidence f_o ={' '}
                        <strong className="text-[#8be0a8]">
                          {caseResults[0]?.coincidenceFreq_Hz.toLocaleString()} Hz
                        </strong>
                        ; peak expander SPL_E ={' '}
                        <strong className="text-[#ffd77a]">
                          {Math.max(...caseResults.map((c) => c.expanderNoise_dBA))} dBA
                        </strong>
                        .
                      </p>
                    </div>
                    <div className="instrument-tile rounded-lg p-3.5 text-xs font-mono">
                      <span className="text-slate-400 block uppercase text-[10px] mb-1">
                        Valve Aspect H/d_port & Low-Freq Pulsation Check
                      </span>
                      <p className="text-slate-200">
                        H / d_port ={' '}
                        <strong className="text-[#7fe0e2]">
                          {caseResults[0]?.strokeToPortAspectRatio}
                        </strong>
                        .{' '}
                        <span
                          className={
                            caseResults[0]?.lowFreqPulsationRisk
                              ? 'text-[#ffd77a] font-semibold'
                              : 'text-[#8be0a8]'
                          }
                        >
                          {caseResults[0]?.lowFreqPulsationRisk
                            ? 'WARNING (Masoneilan/Parcol): Low H/d_port with FTO/high-ΔP gas risks 10–150 Hz instability; consider FTC or 2-stage cage.'
                            : 'PASS: Aspect ratio & flow direction keep low-frequency acoustic instability risk minimal.'}
                        </span>
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* AUTOMATED VALVE SIZE & PRESSURE CLASS SELECTION CARD */}
            <div className="dy-card overflow-hidden">
              <div className="section-band px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#0b2545] border border-[#f2a900]/60 flex items-center justify-center text-[#8be0a8]">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2">
                      Multi-Condition Valve Sizing & Selection Analysis
                      <span className="px-2 py-0.5 rounded bg-[#182028] text-[#8be0a8] border border-[#2f3b47] font-mono text-[10px] font-semibold">
                        ALL CONDITIONS ACCOMMODATED IN ONE VALVE
                      </span>
                    </h2>
                    <p className="text-xs text-slate-300 font-mono">
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0f8b8d] hover:bg-[#0d7678] text-white font-mono font-semibold text-xs transition shadow-sm"
                  >
                    Apply Recommended Valve: DN{valveRecommendation.recommendedDN} ({valveRecommendation.recommendedNPS}) {PRESSURE_CLASSES[valveRecommendation.recommendedPressureClass].label.split('/')[0]}
                  </button>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {/* Readout Metrics (Dark Instrument Panel) */}
                <div className="instrument-panel rounded-xl p-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="instrument-tile rounded-lg p-3">
                    <span className="block text-[10px] font-mono text-slate-400 uppercase">Suggested Size</span>
                    <span className="text-base font-mono font-bold text-[#7fe0e2]">
                      DN{valveRecommendation.recommendedDN} ({valveRecommendation.recommendedNPS})
                    </span>
                    <span className="block text-[10px] font-mono text-slate-400">
                      Bore Ø{GENERIC_VALVE_SCHEDULE.find((s) => s.dn === valveRecommendation.recommendedDN)?.d_port_mm} mm
                    </span>
                  </div>

                  <div className="instrument-tile rounded-lg p-3">
                    <span className="block text-[10px] font-mono text-slate-400 uppercase">Suggested Rating</span>
                    <span className="text-base font-mono font-bold text-[#ffd77a]">
                      {PRESSURE_CLASSES[valveRecommendation.recommendedPressureClass].label.split('/')[0]}
                    </span>
                    <span className="block text-[10px] font-mono text-slate-400">
                      P_max = {valveRecommendation.maxPressureBarA.toFixed(1)} bar a @ {valveRecommendation.maxTemperatureDegC}°C
                    </span>
                  </div>

                  <div className="instrument-tile rounded-lg p-3">
                    <span className="block text-[10px] font-mono text-slate-400 uppercase">Max Required Cv (Capacity)</span>
                    <span className="text-base font-mono font-bold text-[#ffd77a]">
                      {valveRecommendation.maxRequiredCv} Cv
                    </span>
                    <span className="block text-[10px] font-mono text-slate-400">
                      Rated: {valveRecommendation.recommendedRatedCv} Cv ({valveRecommendation.maxPercentOpen}% open)
                    </span>
                  </div>

                  <div className="instrument-tile rounded-lg p-3">
                    <span className="block text-[10px] font-mono text-slate-400 uppercase">Min Required Cv (Turndown)</span>
                    <span className="text-base font-mono font-bold text-[#7fe0e2]">
                      {valveRecommendation.minRequiredCv} Cv
                    </span>
                    <span className="block text-[10px] font-mono text-[#8be0a8] font-semibold">
                      {valveRecommendation.minPercentOpen}% open ({valveRecommendation.turndownRatio}:1 turndown)
                    </span>
                  </div>

                  <div className="instrument-tile rounded-lg p-3">
                    <span className="block text-[10px] font-mono text-slate-400 uppercase">Operating Travel Span</span>
                    <span className="text-base font-mono font-bold text-[#8be0a8]">
                      {valveRecommendation.minPercentOpen}% — {valveRecommendation.maxPercentOpen}%
                    </span>
                    <span className="block text-[10px] font-mono text-slate-400">
                      Linear Trim (Ideal 15%–85%)
                    </span>
                  </div>

                  <div className="instrument-tile rounded-lg p-3">
                    <span className="block text-[10px] font-mono text-slate-400 uppercase">Max Predicted Noise</span>
                    <span className="text-base font-mono font-bold text-[#7fe0e2]">
                      {Math.max(...caseResults.map((c) => c.noiseDrilledCage_dBA))} dBA
                    </span>
                    <span className="block text-[10px] font-mono text-slate-400">
                      Std trim: {Math.max(...caseResults.map((c) => c.noiseStandardTrim_dBA))} dBA
                    </span>
                  </div>
                </div>

                {/* Engineering Rationale bullet list */}
                <div className="bg-[#edf1f5] rounded-lg p-3 border border-[#cfd8e3] text-xs font-mono space-y-1 text-[#0b2545]">
                  {valveRecommendation.rationale.map((r, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="text-[#0f8b8d] font-bold">•</span>
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Top Row: Fluid Preset Loader & Piping Envelope */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Fluid Presets & Custom Dimension Overrides */}
              <div className="lg:col-span-5 dy-card overflow-hidden">
                <div className="section-band px-5 py-3.5">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-[#ffd77a]" />
                    Process Fluid Benchmark Presets & Hardware Overrides
                  </h2>
                  <p className="text-xs text-slate-300 font-mono">
                    Load standard fluid properties or customize bore/stroke/Cv
                  </p>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-xs font-mono text-[#13315c] font-semibold mb-1.5">
                      Quick-Load Process Fluid Preset (Applies to All Operating Cases)
                    </label>
                    <select
                      onChange={(e) => applyFluidPresetToAllCases(e.target.value)}
                      defaultValue="BFW_185C"
                      className="w-full bg-white border border-[#cfd8e3] rounded-lg px-3 py-2 text-xs font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
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
                      <label className="block text-[11px] font-mono text-slate-600 mb-1">
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
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-600 mb-1">
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
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-600 mb-1">
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
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Swaged Piping & Water-Hammer Envelope */}
              <div className="lg:col-span-7 dy-card overflow-hidden">
                <div className="section-band px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Swaged Piping Geometry (FP, FLP, xTP) & Water-Hammer Envelope
                    </h2>
                    <p className="text-xs text-slate-300 font-mono">
                      Coupled concentric reducer/expander head loss & Joukowsky acoustic reflection check
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-[#182028] border border-[#2f3b47] text-xs font-mono text-[#7fe0e2]">
                    Valve d = {correlatedValve.d_mm} mm vs Pipe D1/D2 = {piping.upstreamPipeID_mm}/
                    {piping.downstreamPipeID_mm} mm
                  </span>
                </div>

                <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-[11px] font-mono text-slate-600 mb-1">
                      Upstream Pipe ID D1 (mm)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={piping.upstreamPipeID_mm}
                      onChange={(e) =>
                        setPiping({ ...piping, upstreamPipeID_mm: Number(e.target.value) })
                      }
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-slate-600 mb-1">
                      Downstream Pipe D2 (mm)
                    </label>
                    <input
                      type="number"
                      step="1"
                      value={piping.downstreamPipeID_mm}
                      onChange={(e) =>
                        setPiping({ ...piping, downstreamPipeID_mm: Number(e.target.value) })
                      }
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-slate-600 mb-1">
                      Pipe Wall t_p (mm)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={piping.pipeWallThickness_mm}
                      onChange={(e) =>
                        setPiping({ ...piping, pipeWallThickness_mm: Number(e.target.value) })
                      }
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-slate-600 mb-1">
                      Line Length L (m)
                    </label>
                    <input
                      type="number"
                      step="5"
                      value={piping.upstreamPipeLength_m}
                      onChange={(e) =>
                        setPiping({ ...piping, upstreamPipeLength_m: Number(e.target.value) })
                      }
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-slate-600 mb-1">
                      Fast-Close Time (s)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      value={piping.actuatorCloseTime_s}
                      onChange={(e) =>
                        setPiping({ ...piping, actuatorCloseTime_s: Number(e.target.value) })
                      }
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-mono text-slate-600 mb-1">
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
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1.5 text-xs font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
                    >
                      <option value="STAINLESS_ALLOY">SS / Cr-Mo (≤15 m/s)</option>
                      <option value="CARBON_STEEL">Carbon Steel (≤10.5 m/s)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* DOWNSTREAM BACKPRESSURE ORIFICE / DIFFUSER PRESSURE-SHARING CALCULATOR */}
            <div className="dy-card overflow-hidden">
              <div className="section-band px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#0b2545] border border-[#f2a900]/60 flex items-center justify-center text-[#7fe0e2]">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Downstream Backpressure Orifice / Diffuser Pressure-Sharing Calculator (Parcol / Masoneilan)
                    </h2>
                    <p className="text-xs text-slate-300 font-mono">
                      Raises valve outlet P2* using a downstream fixed orifice/diffuser to suppress cavitation/flashing at high flows
                    </p>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs font-mono text-white cursor-pointer bg-[#0b2545] px-3 py-1.5 rounded border border-[#2f3b47]">
                  <input
                    type="checkbox"
                    checked={enableBackpressureOrifice}
                    onChange={(e) => setEnableBackpressureOrifice(e.target.checked)}
                    className="rounded accent-[#0f8b8d]"
                  />
                  <span>Enable Downstream Backpressure Orifice</span>
                </label>
              </div>

              <div className="p-5 space-y-4">
                <div className="flex flex-wrap items-center gap-6">
                  <div className="flex-1 min-w-[260px]">
                    <div className="flex justify-between text-xs font-mono text-[#13315c] mb-1">
                      <span>Max-Flow ΔP Share Assigned to Downstream Orifice (%)</span>
                      <span className="font-bold text-[#0f8b8d]">{orificeDeltaPSharePct}%</span>
                    </div>
                    <input
                      type="range"
                      min="10"
                      max="75"
                      step="1"
                      value={orificeDeltaPSharePct}
                      disabled={!enableBackpressureOrifice}
                      onChange={(e) => setOrificeDeltaPSharePct(Number(e.target.value))}
                      className="w-full accent-[#0f8b8d] disabled:opacity-40"
                    />
                  </div>
                  <p className="text-xs font-mono text-slate-500 max-w-xl">
                    Note: Orifice ΔP scales quadratically with flow (Q²). Raising P2* at high flow shifts cavitation & supersonic expansion to the static plate, whereas low-flow turndown retains ~full system ΔP on the valve.
                  </p>
                </div>

                {enableBackpressureOrifice && backpressureOrificeResult && (
                  <div className="instrument-panel rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 font-mono text-xs">
                      <div className="instrument-tile rounded-lg p-3">
                        <span className="text-[10px] text-slate-400 uppercase block">Design Governing Case</span>
                        <strong className="text-sm text-[#ffd77a]">
                          {backpressureOrificeResult.designMaxCaseLabel}
                        </strong>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          Orifice ΔP = {backpressureOrificeResult.orificeDeltaPAtMax_bar} bar
                        </span>
                      </div>
                      <div className="instrument-tile rounded-lg p-3">
                        <span className="text-[10px] text-slate-400 uppercase block">Required Orifice Cv</span>
                        <strong className="text-sm text-[#7fe0e2]">
                          {backpressureOrificeResult.orificeRatedCv} Cv
                        </strong>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          Fixed restriction plate
                        </span>
                      </div>
                      <div className="instrument-tile rounded-lg p-3">
                        <span className="text-[10px] text-slate-400 uppercase block">Equiv. Orifice Bore Ø</span>
                        <strong className="text-sm text-[#8be0a8]">
                          Ø{backpressureOrificeResult.equivalentOrificeBore_mm} mm
                        </strong>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          β = {backpressureOrificeResult.orificeBetaRatio} in DN D2 ({piping.downstreamPipeID_mm} mm)
                        </span>
                      </div>
                      <div className="instrument-tile rounded-lg p-3">
                        <span className="text-[10px] text-slate-400 uppercase block">Cases Cavitation Resolved</span>
                        <strong className="text-sm text-[#8be0a8]">
                          {backpressureOrificeResult.caseShares.filter((s) => s.sharedCavitationResolved).length} /{' '}
                          {backpressureOrificeResult.caseShares.length} Cases
                        </strong>
                        <span className="block text-[10px] text-slate-400 mt-0.5">
                          Post-orifice valve σ check
                        </span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse text-xs font-mono">
                        <thead>
                          <tr className="border-b border-[#2f3b47] text-slate-400">
                            <th className="py-2 px-3">Case</th>
                            <th className="py-2 px-2">Orig ΔP_v (bar)</th>
                            <th className="py-2 px-2">Orifice ΔP (bar)</th>
                            <th className="py-2 px-2">Interstage P_mid (bar a)</th>
                            <th className="py-2 px-2">New Valve ΔP_v* (bar)</th>
                            <th className="py-2 px-2">Cavitation σ (Before → After)</th>
                            <th className="py-2 px-2">Valve Noise Drop</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#2f3b47]/60 text-slate-200">
                          {backpressureOrificeResult.caseShares.map((s) => (
                            <tr key={s.id} className="hover:bg-[#182028]">
                              <td className="py-2 px-3 font-semibold text-[#ffd77a]">{s.label}</td>
                              <td className="py-2 px-2">{s.originalValveDeltaP_bar}</td>
                              <td className="py-2 px-2 text-[#7fe0e2]">{s.orificeDeltaP_bar}</td>
                              <td className="py-2 px-2 text-[#8be0a8]">{s.midPressurePmid_bar_a}</td>
                              <td className="py-2 px-2 font-bold">{s.sharedValveDeltaP_bar}</td>
                              <td className="py-2 px-2">
                                {s.originalSigma} →{' '}
                                <span className={s.sharedCavitationResolved ? 'text-[#8be0a8] font-bold' : 'text-[#ff8a80] font-bold'}>
                                  {s.sharedSigma}
                                </span>
                              </td>
                              <td className="py-2 px-2 text-[#8be0a8]">-{s.sharedNoiseReduction_dBA} dBA</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

        {/* =====================================================================
            TAB 2: INHERENT, CUSTOM & INSTALLED FLOW CHARACTERISTICS (Pv & GAIN)
           ===================================================================== */}
        {activeTab === 'CHARACTERISTICS' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Controls: Characteristic Selector, Authority Pv & Custom Spline Editor */}
            <div className="lg:col-span-4 dy-card overflow-hidden">
              <div className="section-band px-5 py-3.5">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#ffd77a]" />
                  Inherent & Custom Trim Characteristic Builder
                </h2>
                <p className="text-xs text-slate-300 font-mono">
                  Configure inherent curve φ(h) and piping Valve Authority Pv
                </p>
              </div>

              <div className="p-5 space-y-5">
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-mono text-[#13315c] font-semibold mb-1">
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
                      className="w-full bg-white border border-[#cfd8e3] rounded-lg px-3 py-2 text-xs font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
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
                  <div className="bg-[#edf1f5] border border-[#cfd8e3] rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-[#13315c] font-semibold">
                        Valve Authority P_v = ΔP_valve(100%) / ΔP_system
                      </span>
                      <span className="text-[#0f8b8d] font-bold">
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
                      className="w-full accent-[#0f8b8d]"
                    />
                    <p className="text-[11px] font-mono text-slate-600">
                      Low Pv (&lt;0.30) indicates high frictional piping loss at max flow, flattening Linear trims.
                    </p>
                  </div>

                  {/* Equal-% Rangeability R */}
                  {(charConfig.type === 'EQUAL_PCT' ||
                    charConfig.type === 'MODIFIED_EQUAL_PCT') && (
                    <div>
                      <label className="block text-xs font-mono text-[#13315c] font-semibold mb-1">
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
                        className="w-full bg-white border border-[#cfd8e3] rounded px-3 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Bi-Linear Knee Point */}
                  {charConfig.type === 'BI_LINEAR' && (
                    <div className="grid grid-cols-2 gap-3 bg-[#edf1f5] p-3 rounded-lg border border-[#cfd8e3]">
                      <div>
                        <label className="block text-[11px] font-mono text-[#13315c] mb-1">
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
                          className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-xs font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-[#13315c] mb-1">
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
                          className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-xs font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Custom Multi-Point PCHIP Spline Editor */}
                  {charConfig.type === 'CUSTOM_SPLINE' && (
                    <div className="bg-[#edf1f5] border border-[#cfd8e3] rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-mono font-semibold text-[#13315c]">
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
                          className="px-2 py-0.5 rounded bg-[#0f8b8d] hover:bg-[#0d7678] text-white text-[11px] font-mono font-semibold"
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
                              className="bg-white border border-[#cfd8e3] rounded px-2 py-1 w-20 text-[#0b2545]"
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
                              className="bg-white border border-[#cfd8e3] rounded px-2 py-1 w-20 text-[#0f8b8d] font-semibold"
                            />
                            <span className="text-slate-500">% Cv</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Loop Gain & EnTec Stability Diagnostic Summary (Dark Instrument Panel) */}
                <div className="instrument-panel rounded-lg p-4 space-y-3">
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
                    <div className="instrument-tile p-2 rounded">
                      <span className="block text-[10px] text-slate-400">Min Gain (15-85%)</span>
                      <span className="text-sm font-bold text-[#ffd77a]">
                        {charSimulation.minInstalledGainWorkingSpan}
                      </span>
                    </div>
                    <div className="instrument-tile p-2 rounded">
                      <span className="block text-[10px] text-slate-400">Max Gain (15-85%)</span>
                      <span className="text-sm font-bold text-[#8be0a8]">
                        {charSimulation.maxInstalledGainWorkingSpan}
                      </span>
                    </div>
                    <div className="instrument-tile p-2 rounded">
                      <span className="block text-[10px] text-slate-400">Gain Ratio</span>
                      <span className="text-sm font-bold text-[#7fe0e2]">
                        {charSimulation.gainRatioWorkingSpan}:1
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center font-mono">
                    <div className="instrument-tile p-2 rounded">
                      <span className="block text-[10px] text-slate-400">Installed Headroom</span>
                      <span
                        className={`text-sm font-bold ${
                          charSimulation.nelesSafetyFactorTrapWarning ? 'text-[#ff8a80]' : 'text-[#8be0a8]'
                        }`}
                      >
                        {charSimulation.nelesInstalledHeadroomPct}%
                      </span>
                      <span className="block text-[9px] text-slate-400">
                        at {charSimulation.nelesInstalledMaxFlowPctOfMax}% Q_max
                      </span>
                    </div>
                    <div className="instrument-tile p-2 rounded">
                      <span className="block text-[10px] text-slate-400">True Min Cv (1/R)</span>
                      <span className="text-sm font-bold text-[#7fe0e2]">
                        {charSimulation.trueMinControllableCv} Cv
                      </span>
                      <span className="block text-[9px] text-slate-400">Warren Table 1</span>
                    </div>
                    <div className="instrument-tile p-2 rounded">
                      <span className="block text-[10px] text-slate-400">1% Stiction Swing</span>
                      <span className="text-sm font-bold text-[#ffd77a]">
                        ±{charSimulation.peakDeadbandFlowSwingPct}%
                      </span>
                      <span className="block text-[9px] text-slate-400">Deadband flow error</span>
                    </div>
                  </div>
                  {charSimulation.nelesSafetyFactorTrapWarning && (
                    <div className="rounded bg-[#ff8a80]/15 border border-[#ff8a80]/40 px-2.5 py-1.5 text-[11px] font-mono text-[#ff8a80]">
                      Neles Safety-Factor Trap: Low Pv distorts installed curve — headroom above max required flow is under 10%.
                    </div>
                  )}
                  <p className="text-xs font-mono text-slate-300 leading-relaxed">
                    {charSimulation.recommendedCharacteristicNote}
                  </p>
                </div>
              </div>
            </div>

            {/* Right Dual SVG Charts: (1) Inherent vs Installed Flow, (2) Installed Gain Curve */}
            <div className="lg:col-span-8 space-y-6">
              {/* Chart 1: Inherent Cv % vs Installed Flow % + Operating Case Markers */}
              <div className="dy-card overflow-hidden">
                <div className="section-band px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Inherent Capacity φ(h) vs. Installed Loop Flow Q(h)/Q_max (at Pv ={' '}
                      {charConfig.valveAuthorityPv.toFixed(2)})
                    </h3>
                    <p className="text-xs text-slate-300 font-mono">
                      Teal = Inherent Trim Curve | Mint = Installed Loop Flow | Amber Dots = Active Process Operating Cases
                    </p>
                  </div>
                </div>

                <div className="p-4">
                  <div className="instrument-panel rounded-lg p-4">
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
                              stroke="#2f3b47"
                              strokeDasharray="3 3"
                            />
                            <line
                              x1={50}
                              y1={y}
                              x2={640}
                              y2={y}
                              stroke="#2f3b47"
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
                        stroke="#475569"
                        strokeDasharray="5 5"
                        strokeWidth="1.2"
                      />

                      {/* Inherent Curve Polyline (#7fe0e2) */}
                      <polyline
                        fill="none"
                        stroke="#7fe0e2"
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

                      {/* Installed Flow Curve Polyline (#8be0a8) */}
                      <polyline
                        fill="none"
                        stroke="#8be0a8"
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

                      {/* Plot Operating Cases on the Inherent Curve (#ffd77a) */}
                      {caseResults.map((c) => {
                        const cx = 50 + (Math.min(100, c.estimatedTravelPct) / 100) * 590;
                        const cy = 245 - (Math.min(100, c.percentOfRatedCv) / 100) * 215;
                        return (
                          <g key={c.id}>
                            <circle
                              cx={cx}
                              cy={cy}
                              r="5.5"
                              fill="#ffd77a"
                              stroke="#0f1419"
                              strokeWidth="2"
                            />
                            <text
                              x={cx + 8}
                              y={cy - 6}
                              fill="#ffd77a"
                              className="text-[10px] font-mono font-bold"
                            >
                              {c.label} ({c.estimatedTravelPct}%)
                            </text>
                          </g>
                        );
                      })}
                    </svg>
                  </div>
                </div>
              </div>

              {/* Chart 2: Installed Gain G_installed(h) vs EnTec [0.5, 2.0] Stability Band */}
              <div className="dy-card overflow-hidden">
                <div className="section-band px-5 py-3.5">
                  <h3 className="text-sm font-bold text-white">
                    Installed Loop Gain G_installed(h) & EnTec [0.5, 2.0] Stability Envelope
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    Shaded Mint Zone = Target [0.5, 2.0] Gain Stability Band across 15%–85% Working Travel
                  </p>
                </div>

                <div className="p-4">
                  <div className="instrument-panel rounded-lg p-4">
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
                            fill="#8be0a8"
                            fillOpacity="0.12"
                            stroke="#8be0a8"
                            strokeOpacity="0.45"
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
                              stroke={gTick === 1.0 ? '#7fe0e2' : '#2f3b47'}
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

                      {/* Inherent Gain Curve (Dashed #7fe0e2) */}
                      <polyline
                        fill="none"
                        stroke="#7fe0e2"
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

                      {/* Installed Gain Curve (Solid #8be0a8) */}
                      <polyline
                        fill="none"
                        stroke="#8be0a8"
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
          </div>
        )}

        {/* =====================================================================
            TAB 3: DRILLED CAGE SYNTHESIS, HOOP STRESS & 2D UNROLLED CAD / CAM
           ===================================================================== */}
        {activeTab === 'CAGE_CAD_STRESS' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Cage Synthesis & ASME Hoop Stress Controls */}
              <div className="lg:col-span-4 dy-card overflow-hidden">
                <div className="section-band px-5 py-3.5 flex items-center justify-between gap-2">
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Drilled Cage Synthesis & Structural Stress Inputs
                    </h2>
                    <p className="text-xs text-slate-300 font-mono">
                      ASME B16.34 / Sec VIII Div. 1 Perforated Sleeve Solver
                    </p>
                  </div>
                  {renderStatusBadge(cageSynthesis.structuralStatus)}
                </div>

                <div className="p-5 space-y-4">
                  <div className="space-y-3">
                    {/* Characterized Cage Profile / Trim Law */}
                    <div className="bg-[#edf1f5] border border-[#cfd8e3] rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-mono text-[#13315c] font-semibold flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-[#0f8b8d]" />
                          Cage Flow Characteristic Law
                        </label>
                        <button
                          type="button"
                          onClick={() => setActiveTab('CHARACTERISTICS')}
                          className="text-[11px] font-mono text-[#0f8b8d] hover:underline"
                          title="Open characteristic curve analysis in Tab 2"
                        >
                          View Curve →
                        </button>
                      </div>

                      {/* Quick Toggles */}
                      <div className="grid grid-cols-4 gap-1 bg-white p-1 rounded-md border border-[#cfd8e3]">
                        {(
                          [
                            { id: 'LINEAR', label: 'Linear' },
                            { id: 'EQUAL_PCT', label: 'Equal %' },
                            { id: 'BI_LINEAR', label: 'Bi-Linear' },
                            { id: 'QUICK_OPENING', label: 'Quick Open' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setCharConfig({ ...charConfig, type: opt.id })}
                            className={`py-1 text-center rounded text-[11px] font-mono font-semibold transition ${
                              charConfig.type === opt.id
                                ? 'bg-[#0f8b8d] text-white shadow-sm'
                                : 'text-slate-600 hover:bg-[#edf1f5]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          value={charConfig.type}
                          onChange={(e) =>
                            setCharConfig({
                              ...charConfig,
                              type: e.target.value as CharacteristicTypeId,
                            })
                          }
                          className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] font-semibold focus:border-[#0f8b8d] focus:outline-none"
                        >
                          <option value="EQUAL_PCT">Equal-Percentage (R^((h-1)))</option>
                          <option value="LINEAR">Linear (φ = h)</option>
                          <option value="MODIFIED_EQUAL_PCT">Modified Equal-% / Parabolic High-Lift</option>
                          <option value="BI_LINEAR">Bi-Linear / Dual-Slope</option>
                          <option value="QUICK_OPENING">Quick-Opening (φ = h^0.45)</option>
                          <option value="MODIFIED_PARABOLIC">Modified Parabolic (φ = h^1.75)</option>
                          <option value="CUSTOM_SPLINE">Custom Multi-Point Spline Table</option>
                          <option value="AUTO_FIT_CONSTANT_GAIN">Auto-Fit Constant Installed Gain</option>
                        </select>

                        {(charConfig.type === 'EQUAL_PCT' || charConfig.type === 'MODIFIED_EQUAL_PCT') && (
                          <select
                            value={charConfig.equalPctRangeability}
                            onChange={(e) =>
                              setCharConfig({
                                ...charConfig,
                                equalPctRangeability: Number(e.target.value),
                              })
                            }
                            className="bg-white border border-[#cfd8e3] rounded px-2 py-1.5 text-xs font-mono text-[#0f8b8d] font-bold focus:border-[#0f8b8d] focus:outline-none shrink-0"
                            title="Inherent Rangeability R"
                          >
                            <option value={30}>R=30</option>
                            <option value={50}>R=50</option>
                            <option value={100}>R=100</option>
                          </select>
                        )}
                      </div>

                      <p className="text-[10.5px] font-mono text-slate-500 leading-tight">
                        Cage hole distribution, row-by-row hole diameters, and ligament stresses automatically re-synthesize to match this curve.
                      </p>
                    </div>

                    <div>
                      <label className="block text-xs font-mono text-[#13315c] font-semibold mb-1">
                        Cage / Sleeve Alloy (ASME / NACE MR0175)
                      </label>
                      <select
                        value={cageMaterial}
                        onChange={(e) => setCageMaterial(e.target.value as CageMaterialId)}
                        className="w-full bg-white border border-[#cfd8e3] rounded-lg px-3 py-2 text-xs font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
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
                        <label className="block text-[11px] font-mono text-slate-600 mb-1">
                          Axial Hole Rows N_rows
                        </label>
                        <input
                          type="number"
                          min="4"
                          max="30"
                          value={numRows}
                          onChange={(e) => setNumRows(Number(e.target.value))}
                          className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-600 mb-1">
                          Base Orifice Ød_h (mm)
                        </label>
                        <input
                          type="number"
                          step="0.2"
                          min="1.5"
                          max="16"
                          value={baseHoleDia_mm}
                          onChange={(e) => setBaseHoleDia_mm(Number(e.target.value))}
                          className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-600 mb-1">
                          Cage Wall t_cage (mm)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="2.5"
                          value={selectedWallThickness_mm}
                          onChange={(e) => setSelectedWallThickness_mm(Number(e.target.value))}
                          className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-slate-600 mb-1">
                          Erosion Allowance (mm)
                        </label>
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          value={erosionAllowance_mm}
                          onChange={(e) => setErosionAllowance_mm(Number(e.target.value))}
                          className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <label className="flex items-center gap-2 text-xs font-mono text-[#0b2545] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={modulateHoleDiameter}
                          onChange={(e) => setModulateHoleDiameter(e.target.checked)}
                          className="accent-[#0f8b8d]"
                        />
                        Graduated Low-Lift Hole Ø Modulation
                      </label>
                      <label className="flex items-center gap-2 text-xs font-mono text-[#13315c] font-semibold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={requireNaceSourService}
                          onChange={(e) => setRequireNaceSourService(e.target.checked)}
                          className="accent-[#0f8b8d]"
                        />
                        NACE MR0175 Sour
                      </label>
                    </div>

                    {/* ZERO-DEADBAND OVERLAPPING ROW & SIBANDA (2022) GALLERY PHYSICS CONTROLS */}
                    <div className="bg-[#edf1f5] border border-[#cfd8e3] rounded-lg p-3 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <label className="flex items-center gap-2 text-xs font-mono font-semibold text-[#13315c] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enforceZeroDeadbandOverlap}
                            onChange={(e) => setEnforceZeroDeadbandOverlap(e.target.checked)}
                            className="accent-[#0f8b8d]"
                          />
                          Zero-Deadband Axial Row Overlap (p_z &lt; d_h)
                        </label>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#182028] border border-[#2f3b47] ${
                            cageSynthesis.deadbandStrokePct <= 0.1
                              ? 'text-[#8be0a8]'
                              : 'text-[#ff8a80]'
                          }`}
                        >
                          DEADBAND: {cageSynthesis.deadbandStrokePct}%
                        </span>
                      </div>

                      <div>
                        <div className="flex justify-between text-[11px] font-mono text-slate-600 mb-1">
                          <span>Target Axial Row Overlap λ_overlap</span>
                          <span className="text-[#0f8b8d] font-bold">
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
                          className="w-full accent-[#0f8b8d]"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-mono text-[#13315c] font-semibold mb-1">
                          Hole Spacing Design Priority (2D Center-to-Center P / Ligament L)
                        </label>
                        <select
                          value={holeSpacingRule}
                          onChange={(e) => setHoleSpacingRule(e.target.value as HoleSpacingRuleId)}
                          className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[11px] font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
                        >
                          {Object.values(HOLE_SPACING_RULES).map((rule) => (
                            <option key={rule.id} value={rule.id}>
                              {rule.label}
                            </option>
                          ))}
                        </select>
                        <p className="text-[10px] font-mono text-slate-600 mt-1">
                          Driver: {HOLE_SPACING_RULES[holeSpacingRule].driver}
                        </p>
                      </div>

                      <label className="flex items-center gap-2 text-[11px] font-mono text-[#0b2545] cursor-pointer pt-0.5">
                        <input
                          type="checkbox"
                          checked={showSibandaGalleryHeatmap}
                          onChange={(e) => setShowSibandaGalleryHeatmap(e.target.checked)}
                          className="accent-[#0f8b8d]"
                        />
                        Sibanda (2022) Eq. 5.10 3D Gallery Local Cv(θ, z) &amp; Separation Overlay
                      </label>
                    </div>
                  </div>

                  {/* Structural Stress & Ligament Verification Readout (Dark Instrument Panel) */}
                  <div className="instrument-panel rounded-lg p-3.5 space-y-2 font-mono text-xs">
                    <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between">
                      <span className="text-slate-400">Cage ID / OD:</span>
                      <span className="text-[#7fe0e2] font-semibold">
                        Ø{cageSynthesis.cageID_mm} mm / Ø{cageSynthesis.cageOD_mm} mm
                      </span>
                    </div>
                    <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between">
                      <span className="text-slate-400">Min 2D Hole Spacing (P / L):</span>
                      <span
                        className={
                          cageSynthesis.minPitchToDiaRatio >=
                          HOLE_SPACING_RULES[holeSpacingRule].minPitchToDia - 0.02
                            ? 'text-[#8be0a8] font-bold'
                            : 'text-[#ffd77a] font-bold'
                        }
                      >
                        P = {cageSynthesis.minPitchToDiaRatio}d | L = {cageSynthesis.minLigamentToDiaRatio}d
                      </span>
                    </div>
                    <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between">
                      <span className="text-slate-400">Zero-Deadband Continuity:</span>
                      <span
                        className={
                          cageSynthesis.deadbandStrokePct === 0
                            ? 'text-[#8be0a8] font-bold'
                            : 'text-[#ffd77a] font-bold'
                        }
                      >
                        {cageSynthesis.deadbandStrokePct === 0
                          ? `Continuous dA/dh > 0 (Overlap ${cageSynthesis.meanRowOverlapPct}%)`
                          : `Deadband ${cageSynthesis.deadbandStrokePct}% (Max Gap ${cageSynthesis.maxDeadbandGap_mm} mm)`}
                      </span>
                    </div>
                    <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between">
                      <span className="text-slate-400">Circular-Segment Curve-Fit RMS:</span>
                      <span className="text-[#7fe0e2] font-semibold">
                        {cageSynthesis.curveFitRMSDeviationPct}% RMS Error
                      </span>
                    </div>
                    <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between">
                      <span className="text-slate-400">Min Required Cage Wall t_min:</span>
                      <span
                        className={
                          cageSynthesis.selectedWallThickness_mm >=
                          cageSynthesis.minRequiredWallThickness_mm
                            ? 'text-[#8be0a8] font-bold'
                            : 'text-[#ff8a80] font-bold'
                        }
                      >
                        {cageSynthesis.minRequiredWallThickness_mm} mm (Selected:{' '}
                        {cageSynthesis.selectedWallThickness_mm} mm)
                      </span>
                    </div>
                    <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between">
                      <span className="text-slate-400">Perforated Hoop Stress σ_hoop:</span>
                      <span
                        className={
                          cageSynthesis.hoopStress_MPa <= cageSynthesis.allowableStressSm_MPa
                            ? 'text-[#8be0a8] font-bold'
                            : 'text-[#ff8a80] font-bold'
                        }
                      >
                        {cageSynthesis.hoopStress_MPa} MPa / {cageSynthesis.allowableStressSm_MPa} MPa (
                        {cageSynthesis.hoopStressUtilizationPct}%)
                      </span>
                    </div>
                    <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between">
                      <span className="text-slate-400">Buckling Collapse Pressure:</span>
                      <span className="text-[#ffd77a] font-semibold">
                        {cageSynthesis.criticalCollapsePressure_bar} bar (SF ={' '}
                        {cageSynthesis.collapseSafetyFactor}x)
                      </span>
                    </div>
                    <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between">
                      <span className="text-slate-400">Min Ligament Width / Efficiency:</span>
                      <span
                        className={
                          cageSynthesis.minLigamentWidth_mm >= 1.5
                            ? 'text-[#8be0a8]'
                            : 'text-[#ff8a80] font-bold'
                        }
                      >
                        {cageSynthesis.minLigamentWidth_mm} mm (η ={' '}
                        {(cageSynthesis.minLigamentEfficiency * 100).toFixed(1)}%)
                      </span>
                    </div>
                    <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between">
                      <span className="text-slate-400">IEC 60534-8-3 Pitch/Dia (≥2.0):</span>
                      <span
                        className={
                          cageSynthesis.jetCoalescenceCompliant
                            ? 'text-[#8be0a8]'
                            : 'text-[#ffd77a]'
                        }
                      >
                        {cageSynthesis.minPitchToDiaRatio}x (
                        {cageSynthesis.jetCoalescenceCompliant ? 'Anti-Coalescence OK' : 'Tight Pitch'})
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive 2D Unrolled Cage CAD Blueprint + Live Plug Travel Slider */}
              <div className="lg:col-span-8 dy-card overflow-hidden">
                <div className="section-band px-5 py-3.5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      2D Unrolled Cylindrical Cage Perforation Blueprint (Circumference π·D_ID ={' '}
                      {(Math.PI * cageSynthesis.cageID_mm).toFixed(1)} mm × Stroke H ={' '}
                      {correlatedValve.stroke_mm} mm)
                    </h2>
                    <p className="text-xs text-slate-300 font-mono">
                      Overlapping Staggered Rows (p_z &lt; d_h) eliminate axial deadband | Sibanda (2022) 3D Gallery Local Cv(θ, z) Heatmap
                    </p>
                  </div>

                  {/* Live Plug Travel Curtain Slider */}
                  <div className="flex items-center gap-3 bg-[#182028] px-3.5 py-2 rounded-lg border border-[#2f3b47]">
                    <span className="text-xs font-mono text-slate-300">
                      Live Plug Lift: <strong className="text-[#7fe0e2]">{livePlugTravelPct}%</strong>
                    </span>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={livePlugTravelPct}
                      onChange={(e) => setLivePlugTravelPct(Number(e.target.value))}
                      className="w-32 accent-[#0f8b8d]"
                    />
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {/* Blueprint CAD Viewport (Dark Instrument Panel #0f1419) */}
                  <div className="instrument-panel rounded-xl p-4 relative overflow-hidden">
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
                                      fill="#ffd77a"
                                      fillOpacity="0.07"
                                    />
                                    <text
                                      x={xCenter}
                                      y={padT - 8}
                                      textAnchor="middle"
                                      fill="#ffd77a"
                                      className="text-[8.5px] font-mono"
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
                                fill="#8be0a8"
                                className="text-[8.5px] font-mono"
                              >
                                0° INLET STAGNATION PEAK
                              </text>
                              <text
                                x={padL + 0.5 * plotW}
                                y={padT - 8}
                                textAnchor="middle"
                                fill="#7fe0e2"
                                className="text-[8.5px] font-mono"
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
                                  stroke="#2f3b47"
                                  strokeWidth="1"
                                  strokeOpacity="0.55"
                                />
                                <text
                                  x={x}
                                  y={svgH - 10}
                                  textAnchor="middle"
                                  className="fill-slate-400 text-[9.5px] font-mono"
                                >
                                  {deg}° ({((deg / 360) * circum).toFixed(0)}mm)
                                </text>
                              </g>
                            );
                          })}

                          {/* Seat Line at Z = 0 mm */}
                          <line
                            x1={padL}
                            y1={padT + plotH}
                            x2={padL + plotW}
                            y2={padT + plotH}
                            stroke="#8be0a8"
                            strokeWidth="1.5"
                          />

                          {/* Plug Masked Curtain Overlay */}
                          <rect
                            x={padL}
                            y={padT}
                            width={plotW}
                            height={Math.max(0, plugY - padT)}
                            fill="#182028"
                            fillOpacity="0.6"
                          />

                          {/* Drilled Orifice Rows */}
                          {cageSynthesis.rows.map((row) => {
                            const cy = padT + plotH - (row.zElevation_mm / maxZ) * plotH;
                            const ryPx = Math.max(
                              2.0,
                              ((row.holeDia_mm * 0.5) / maxZ) * plotH
                            );
                            const rxPx = Math.max(
                              2.0,
                              ((row.holeDia_mm * 0.5) / circum) * plotW
                            );

                            const openFrac =
                              plugZ_mm <= row.zBottom_mm
                                ? 0
                                : plugZ_mm >= row.zTop_mm
                                ? 1
                                : (plugZ_mm - row.zBottom_mm) / Math.max(0.1, row.holeDia_mm);

                            return (
                              <g key={row.rowIndex}>
                                <line
                                  x1={padL}
                                  y1={cy}
                                  x2={padL + plotW}
                                  y2={cy}
                                  stroke="#2f3b47"
                                  strokeDasharray="2 4"
                                  strokeOpacity="0.45"
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

                                  const sibanda = evaluateSibandaLocalHoleFactor({
                                    angle_deg: deg,
                                    zElevation_mm: row.zElevation_mm,
                                    stroke_mm: correlatedValve.stroke_mm,
                                    holeDia_mm: row.holeDia_mm,
                                    cageID_mm: cageSynthesis.cageID_mm,
                                  });

                                  let strokeColor = '#2f3b47';
                                  let fillColor = '#182028';
                                  if (openFrac > 0) {
                                    if (showSibandaGalleryHeatmap) {
                                      if (sibanda.relativeWeight >= 1.04) {
                                        strokeColor = '#8be0a8';
                                        fillColor =
                                          openFrac < 1
                                            ? 'rgba(139, 224, 168, 0.20)'
                                            : 'rgba(139, 224, 168, 0.35)';
                                      } else if (sibanda.relativeWeight <= 0.9) {
                                        strokeColor = '#ffd77a';
                                        fillColor =
                                          openFrac < 1
                                            ? 'rgba(255, 215, 122, 0.20)'
                                            : 'rgba(255, 215, 122, 0.34)';
                                      } else {
                                        strokeColor = '#7fe0e2';
                                        fillColor =
                                          openFrac < 1
                                            ? 'rgba(127, 224, 226, 0.18)'
                                            : 'rgba(127, 224, 226, 0.32)';
                                      }
                                    } else {
                                      strokeColor = openFrac < 1 ? '#ffd77a' : '#7fe0e2';
                                      fillColor =
                                        openFrac < 1
                                          ? 'rgba(255, 215, 122, 0.22)'
                                          : 'rgba(127, 224, 226, 0.28)';
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
                            stroke="#ffd77a"
                            strokeWidth="2.2"
                            strokeDasharray="6 4"
                          />
                          <text
                            x={padL + plotW - 6}
                            y={Math.max(padT + 12, plugY - 6)}
                            textAnchor="end"
                            fill="#ffd77a"
                            className="text-[10px] font-mono font-bold"
                          >
                            PLUG METERING EDGE (Z = {plugZ_mm.toFixed(1)} mm)
                          </text>
                        </svg>
                      );
                    })()}
                  </div>

                  {/* Legend for Zero-Deadband & Sibanda (2022) 3D Gallery Physics (Dark Instrument Tiles) */}
                  <div className="instrument-panel rounded-xl p-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] font-mono">
                    <div className="instrument-tile rounded-lg p-2.5">
                      <span className="text-[#8be0a8] font-bold block">
                        1. Zero Initial &amp; Inter-Row Deadband
                      </span>
                      <span className="text-slate-300">
                        Row 1 bottom tangent to Z=0.0mm; adjacent staggered rows overlap vertically by{' '}
                        {cageSynthesis.meanRowOverlapPct}% (p_z &lt; d_h) so dA/dh &gt; 0 everywhere.
                      </span>
                    </div>
                    <div className="instrument-tile rounded-lg p-2.5">
                      <span className="text-[#7fe0e2] font-bold block">
                        2. Sibanda (2022) Eq. 5.10 Gallery Flow
                      </span>
                      <span className="text-slate-300">
                        Cv_hole = A·Re^a·D^b·HT^c·θ̄^d (R²=0.947): Peak Cv at 0° inlet stagnation &amp; upper rows (HT^0.150).
                      </span>
                    </div>
                    <div className="instrument-tile rounded-lg p-2.5">
                      <span className="text-[#ffd77a] font-bold block">
                        3. Flank Separation Zones (135° &amp; 225°)
                      </span>
                      <span className="text-slate-300">
                        Boundary-layer separation at θ ≈ 135° &amp; 225° reduces local hole ΔP and Cv, concentrating cavitation risk.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Row: Continuous Circular-Segment Uncovering Curve (Zero-Deadband Proof) & Sibanda 360° Angular Cv Profile */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Chart A: Continuous Circular-Segment Uncovering Cv(h) vs Target + Instantaneous Chord Gain dA/dh */}
              <div className="lg:col-span-7 dy-card overflow-hidden">
                <div className="section-band px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Continuous Circular-Segment Uncovering Curve Cv(h) &amp; Chord Width Gain dA/dh
                    </h3>
                    <p className="text-xs text-slate-300 font-mono">
                      Teal = Synthesized Circular-Segment Trim Cv(h) | Dashed Slate = Target Curve | Mint = Instantaneous Chord Width dA/dh (mm²/mm)
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-[#182028] text-[#8be0a8] border border-[#2f3b47] text-xs font-mono font-bold">
                    Deadband: {cageSynthesis.deadbandStrokePct}% | RMS Dev: {cageSynthesis.curveFitRMSDeviationPct}%
                  </span>
                </div>

                <div className="p-4">
                  <div className="instrument-panel rounded-lg p-4">
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
                                  stroke="#2f3b47"
                                  strokeDasharray="3 3"
                                />
                                <line
                                  x1={50}
                                  y1={y}
                                  x2={640}
                                  y2={y}
                                  stroke="#2f3b47"
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

                          {/* Instantaneous Chord Width Gain dA/dh (Mint Curve #8be0a8) */}
                          <polyline
                            fill="none"
                            stroke="#8be0a8"
                            strokeWidth="1.6"
                            strokeOpacity="0.9"
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

                          {/* Synthesized Circular-Segment Valve Cv(h) Curve (Solid #7fe0e2) */}
                          <polyline
                            fill="none"
                            stroke="#7fe0e2"
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
              </div>

              {/* Chart B: Sibanda (2022) Eq. 5.10 360° Gallery Circumferential Hole Cv Distribution */}
              <div className="lg:col-span-5 dy-card overflow-hidden">
                <div className="section-band px-5 py-3.5">
                  <h3 className="text-sm font-bold text-white">
                    Sibanda (2022) Ch. 5 Gallery Circumferential Hole Cv(θ) Profile
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    Normalized Local Orifice Capacity around 0°–360° Gallery (Inlet 0° vs. 135°/225° Separation vs. 180° Rear)
                  </p>
                </div>

                <div className="p-4">
                  <div className="instrument-panel rounded-lg p-4">
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
                                  stroke={isSep ? '#ffd77a' : '#2f3b47'}
                                  strokeDasharray={isSep ? '4 3' : '2 3'}
                                  strokeOpacity={isSep ? '0.65' : '1'}
                                />
                                <text
                                  x={x}
                                  y={214}
                                  textAnchor="middle"
                                  fill={isSep ? '#ffd77a' : '#94a3b8'}
                                  className={`text-[9.5px] font-mono ${isSep ? 'font-bold' : ''}`}
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
                                  stroke={mult === 1.0 ? '#475569' : '#2f3b47'}
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

                          {/* Upper Row (HT = 0.90) Sibanda Profile (#8be0a8) */}
                          <polyline
                            fill="none"
                            stroke="#8be0a8"
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

                          {/* Bottom Seat Row (HT = 0.12) Sibanda Profile (#7fe0e2) */}
                          <polyline
                            fill="none"
                            stroke="#7fe0e2"
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
            </div>

            {/* Bottom Row: Discrete Axial Row Schedule Table & 4-Axis CNC G-Code Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 dy-card overflow-hidden">
                <div className="section-band px-5 py-3.5">
                  <h3 className="text-sm font-bold text-white">
                    Zero-Deadband Overlapping Axial Hole Row Schedule (R1 to R{cageSynthesis.rows.length})
                  </h3>
                </div>
                <div className="p-5">
                  <div className="overflow-x-auto max-h-80">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="border-b border-[#cfd8e3] text-[#13315c] bg-[#edf1f5] sticky top-0">
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
                      <tbody className="divide-y divide-[#e2e8f0]">
                        {cageSynthesis.rows.map((r) => (
                          <tr key={r.rowIndex} className="hover:bg-[#f8fafc]">
                            <td className="py-1.5 px-2 font-bold text-[#0f8b8d]">R{r.rowIndex}</td>
                            <td className="py-1.5 px-2 text-[#0b2545]">
                              {r.zElevation_mm}{' '}
                              <span className="text-slate-500 text-[10px]">
                                [{r.zBottom_mm}–{r.zTop_mm}]
                              </span>
                            </td>
                            <td className="py-1.5 px-2 text-[#0b2545]">Ø{r.holeDia_mm} mm</td>
                            <td className="py-1.5 px-2 font-bold text-[#0b2545]">{r.holeCount}</td>
                            <td className="py-1.5 px-2 text-emerald-700 font-semibold">
                              {r.rowIndex === 1 ? 'Seat Tangent' : `${r.axialOverlapPct}%`}
                            </td>
                            <td className="py-1.5 px-2 text-slate-700">
                              {r.circumferentialPitch_mm} ({r.pitchToDiaRatio}x)
                            </td>
                            <td className="py-1.5 px-2 text-slate-700">{r.ligamentWidth_mm} mm</td>
                            <td className="py-1.5 px-2 text-[#0f8b8d] font-semibold">
                              {r.sibandaRowElevationFactor}x
                            </td>
                            <td className="py-1.5 px-2 font-bold text-emerald-700">
                              {r.cumulativeCv}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* 4-Axis CNC G-Code Terminal */}
              <div className="lg:col-span-5 dy-card overflow-hidden">
                <div className="section-band px-5 py-3.5 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white">
                    4-Axis Rotary Indexer CNC G-Code (G83 Peck Drill)
                  </h3>
                  <button
                    onClick={handleExportGCode}
                    className="px-2.5 py-1 rounded bg-[#0f8b8d] hover:bg-[#0d7678] text-white text-xs font-mono font-semibold transition"
                  >
                    Export .NC
                  </button>
                </div>
                <div className="p-5">
                  <pre className="instrument-panel rounded-lg p-3.5 text-[11px] font-mono text-[#8be0a8] overflow-y-auto max-h-80 leading-relaxed">
                    {generate4AxisCageGCode(cageSynthesis).slice(0, 2600)}
                    {'\n... [TRUNCATED IN PREVIEW — CLICK EXPORT .NC FOR FULL PROGRAM]'}
                  </pre>
                </div>
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
            <div className="lg:col-span-4 dy-card overflow-hidden">
              <div className="section-band px-5 py-3.5 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Thermometer className="w-4 h-4 text-[#ffd77a]" />
                    Transient Thermal Differential Expansion
                  </h2>
                  <p className="text-xs text-slate-300 font-mono">
                    Lumped-capacitance thermal lag (-196°C to +580°C)
                  </p>
                </div>
                {renderStatusBadge(thermalResult.radialBindingRisk)}
              </div>

              <div className="p-5 space-y-4">
                <div className="space-y-3 text-xs font-mono">
                  <div>
                    <label className="block text-[#13315c] font-semibold mb-1">Plug Head / Skirt Alloy</label>
                    <select
                      value={plugAlloy}
                      onChange={(e) => setPlugAlloy(e.target.value as ThermalAlloyId)}
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
                    >
                      {Object.values(THERMAL_ALLOYS).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (α={a.alpha_1e6_per_K} µm/m·K)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#13315c] font-semibold mb-1">Cage Sleeve Guide Alloy</label>
                    <select
                      value={cageAlloy}
                      onChange={(e) => setCageAlloy(e.target.value as ThermalAlloyId)}
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                    >
                      {Object.values(THERMAL_ALLOYS).map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name} (α={a.alpha_1e6_per_K} µm/m·K)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#13315c] font-semibold mb-1">Valve Body Pressure Boundary Alloy</label>
                    <select
                      value={bodyAlloy}
                      onChange={(e) => setBodyAlloy(e.target.value as ThermalAlloyId)}
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
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
                      <label className="block text-slate-600 mb-1">Initial Temp T0 (°C)</label>
                      <input
                        type="number"
                        value={initialTemp_degC}
                        onChange={(e) => setInitialTemp_degC(Number(e.target.value))}
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">Final Process T_∞ (°C)</label>
                      <input
                        type="number"
                        value={finalProcessTemp_degC}
                        onChange={(e) => setFinalProcessTemp_degC(Number(e.target.value))}
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">Warmup Ramp (°C/min)</label>
                      <input
                        type="number"
                        min="0"
                        value={rampRate_degC_per_min}
                        onChange={(e) => setRampRate_degC_per_min(Number(e.target.value))}
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">Cold Radial Gap (mm)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={coldRadialClearance_mm}
                        onChange={(e) => setColdRadialClearance_mm(Number(e.target.value))}
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-mono text-[#13315c] font-semibold pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={requireLethalBellowsSeal}
                      onChange={(e) => setRequireLethalBellowsSeal(e.target.checked)}
                      className="accent-[#0f8b8d]"
                    />
                    Lethal / Zero-Emission Metallic Bellows Seal Service
                  </label>
                </div>

                {/* Thermal Time Constants & Pinch Readout (Dark Instrument Panel) */}
                <div className="instrument-panel rounded-lg p-3.5 space-y-2 text-xs font-mono">
                  <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between">
                    <span className="text-slate-400">Time Constants (τ_cage / τ_plug / τ_body):</span>
                    <span className="text-[#7fe0e2] font-semibold">
                      {thermalResult.tauCage_s}s / {thermalResult.tauPlug_s}s / {thermalResult.tauBody_s}s
                    </span>
                  </div>
                  <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between">
                    <span className="text-slate-400">Min Transient Radial Clearance:</span>
                    <span
                      className={
                        thermalResult.minTransientRadialClearance_mm >=
                        thermalResult.minSafeRadialClearanceFloor_mm
                          ? 'text-[#8be0a8] font-bold'
                          : 'text-[#ff8a80] font-bold'
                      }
                    >
                      {thermalResult.minTransientRadialClearance_mm} mm (at t ={' '}
                      {thermalResult.timeOfMinClearance_s}s)
                    </span>
                  </div>
                  <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between">
                    <span className="text-slate-400">Recommended Cold Radial Clearance:</span>
                    <span className="text-[#8be0a8] font-bold">
                      ≥ {thermalResult.recommendedColdRadialClearance_mm} mm
                    </span>
                  </div>
                  <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between">
                    <span className="text-slate-400">Max Axial Sleeve-in-Body Crush:</span>
                    <span className="text-[#ffd77a]">
                      {thermalResult.maxAxialDifferentialExpansion_mm} mm (Limit:{' '}
                      {axialGasketAllowance_mm} mm)
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Transient Radial Clearance Pinch Chart & Bonnet Isolation Advisor */}
            <div className="lg:col-span-8 space-y-6">
              {/* Transient Radial Clearance Chart */}
              <div className="dy-card overflow-hidden">
                <div className="section-band px-5 py-3.5">
                  <h3 className="text-sm font-bold text-white">
                    Transient Radial Guide Clearance c_radial(t) & Component Thermal Lag Response
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    Tracks differential expansion between Austenitic/Martensitic Plug and Cage during thermal transient
                  </p>
                </div>

                <div className="p-4">
                  <div className="instrument-panel rounded-lg p-4">
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
                          {/* Minimum Safe Clearance Floor Line (#ff8a80) */}
                          <line
                            x1={50}
                            y1={floorY}
                            x2={640}
                            y2={floorY}
                            stroke="#ff8a80"
                            strokeWidth="1.5"
                            strokeDasharray="5 4"
                          />
                          <text
                            x={635}
                            y={floorY - 6}
                            textAnchor="end"
                            fill="#ff8a80"
                            className="text-[10px] font-mono font-bold"
                          >
                            ANTI-SEIZURE CLEARANCE FLOOR ({thermalResult.minSafeRadialClearanceFloor_mm}{' '}
                            mm)
                          </text>

                          {/* Radial Clearance Curve (#7fe0e2) */}
                          <polyline
                            fill="none"
                            stroke="#7fe0e2"
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
              </div>

              {/* Bonnet Style & Packing Box Thermal Isolation Advisor Card */}
              <div className="dy-card overflow-hidden">
                <div className="section-band px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-mono uppercase tracking-wider text-white font-semibold">
                    Bonnet Style & Packing Box Thermal Isolation Advisor (Emerson Ch. 3 & Skousen Ch. 2)
                  </span>
                  <span className="px-2.5 py-0.5 rounded bg-[#182028] text-[#ffd77a] border border-[#2f3b47] text-xs font-mono font-bold">
                    Est. Packing Box Temp: {thermalResult.bonnetAdvisor.estimatedPackingBoxTemp_degC} °C
                  </span>
                </div>
                <div className="p-5 space-y-3">
                  <h3 className="text-base font-bold text-[#0b2545]">
                    {thermalResult.bonnetAdvisor.bonnetTitle}
                  </h3>
                  <p className="text-xs font-mono text-[#13315c]">
                    Recommended Packing Arrangement:{' '}
                    <strong className="text-[#0f8b8d]">
                      {thermalResult.bonnetAdvisor.recommendedPackingSystem}
                    </strong>
                  </p>
                  <p className="text-xs text-slate-600 font-mono leading-relaxed">
                    {thermalResult.bonnetAdvisor.bonnetRationale}
                  </p>
                </div>
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
            <div className="lg:col-span-4 dy-card overflow-hidden">
              <div className="section-band px-5 py-3.5 flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-white">
                    Actuator Bench Set & Stem Structural Inputs
                  </h2>
                  <p className="text-xs text-slate-300 font-mono">
                    F_total = A + B + C + D & Euler Column Buckling
                  </p>
                </div>
                {renderStatusBadge(actuatorStemResult.stemStructuralStatus)}
              </div>

              <div className="p-5 space-y-3 text-xs font-mono">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[#13315c] font-semibold mb-1">
                      ANSI/FCI 70-2 Shutoff Class
                    </label>
                    <select
                      value={shutoffClass}
                      onChange={(e) => setShutoffClass(e.target.value as ShutoffClassId)}
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1.5 text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
                    >
                      <option value="CLASS_II">Class II (0.5% Metal)</option>
                      <option value="CLASS_III">Class III (0.1% Metal)</option>
                      <option value="CLASS_IV">Class IV (0.01% Std Metal)</option>
                      <option value="CLASS_V">Class V (Tight Metal Letdown)</option>
                      <option value="CLASS_VI">Class VI (Soft Seat PTFE)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#13315c] font-semibold mb-1">Stem Packing Type</label>
                    <select
                      value={packingType}
                      onChange={(e) => setPackingType(e.target.value as PackingTypeId)}
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
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
                    <label className="block text-[#13315c] font-semibold mb-1">Balanced Plug Seal</label>
                    <select
                      value={balanceSealType}
                      onChange={(e) => setBalanceSealType(e.target.value as BalanceSealTypeId)}
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                    >
                      <option value="PTFE_SPRING_ENERGIZED">Spring-Energized PTFE</option>
                      <option value="GRAPHITE_PISTON_RING">High-Temp Graphite Ring</option>
                      <option value="NONE_METAL_CLEARANCE">Metal Clearance Seal</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[#13315c] font-semibold mb-1">Actuator Fail Action</label>
                    <select
                      value={failAction}
                      onChange={(e) => setFailAction(e.target.value as FailActionId)}
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1.5 text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
                    >
                      <option value="FAIL_CLOSED_ATO">Fail-Closed (Spring-to-Close)</option>
                      <option value="FAIL_OPEN_ATC">Fail-Open (Air-to-Close)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-600 mb-1">
                      Diaphragm Area A_eff (cm²)
                    </label>
                    <input
                      type="number"
                      step="50"
                      value={actuatorArea_cm2}
                      onChange={(e) => setActuatorArea_cm2(Number(e.target.value))}
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">
                      Supply Air P_supply (bar g)
                    </label>
                    <input
                      type="number"
                      step="0.2"
                      value={airSupply_bar_g}
                      onChange={(e) => setAirSupply_bar_g(Number(e.target.value))}
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">
                      Bench Set Lower (bar g)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={benchSetLower_bar_g}
                      onChange={(e) => setBenchSetLower_bar_g(Number(e.target.value))}
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">
                      Bench Set Upper (bar g)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={benchSetUpper_bar_g}
                      onChange={(e) => setBenchSetUpper_bar_g(Number(e.target.value))}
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="border-t border-[#cfd8e3] pt-3 space-y-3">
                  <div>
                    <label className="block text-[#13315c] font-semibold mb-1">Stem Bar Material</label>
                    <select
                      value={stemMaterial}
                      onChange={(e) => setStemMaterial(e.target.value as StemMaterialId)}
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
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
                      <label className="block text-slate-600 mb-1">
                        Selected Stem Ød_stem (mm)
                      </label>
                      <select
                        value={selectedStemDia_mm}
                        onChange={(e) => setSelectedStemDia_mm(Number(e.target.value))}
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                      >
                        {STANDARD_METRIC_STEM_DIAMETERS_MM.map((d) => (
                          <option key={d} value={d}>
                            Ø{d} mm
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">
                        Unsupported Stem L (mm)
                      </label>
                      <input
                        type="number"
                        step="10"
                        value={unsupportedStemLength_mm}
                        onChange={(e) => setUnsupportedStemLength_mm(Number(e.target.value))}
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
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
                <div className="dy-card overflow-hidden font-mono">
                  <div className="section-band px-5 py-3.5 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-white">
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
                  <div className="p-4">
                    <div className="instrument-panel rounded-lg p-3 space-y-1.5 text-xs">
                      <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between text-slate-300">
                        <span>Force A (Fluid Unbalance):</span>
                        <span className="text-[#ffd77a] font-semibold">{actuatorStemResult.unbalanced.fluidUnbalanceForceA_N.toLocaleString()} N</span>
                      </div>
                      <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between text-slate-300">
                        <span>Force B (FCI 70-2 Seat Load):</span>
                        <span className="text-slate-100">{actuatorStemResult.unbalanced.seatLoadForceB_N.toLocaleString()} N</span>
                      </div>
                      <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between text-slate-300">
                        <span>Force C (Packing Friction):</span>
                        <span className="text-slate-100">{actuatorStemResult.unbalanced.packingFrictionForceC_N.toLocaleString()} N</span>
                      </div>
                      <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between text-slate-300">
                        <span>Force D (Bellows / Drag):</span>
                        <span className="text-slate-100">{actuatorStemResult.unbalanced.sealAndBellowsForceD_N.toLocaleString()} N</span>
                      </div>
                      <div className="border-t border-[#2f3b47] pt-2 px-1 flex justify-between font-bold text-sm text-[#ffd77a]">
                        <span>Required Thrust (1.25x SF):</span>
                        <span>{actuatorStemResult.unbalanced.totalWithSafetyMargin_N.toLocaleString()} N</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Balanced Cage-Guided Plug Card */}
                <div className="dy-card overflow-hidden font-mono">
                  <div className="section-band px-5 py-3.5 flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-[#7fe0e2]">
                      Balanced Cage-Guided Plug (-{actuatorStemResult.thrustReductionPct}% Thrust)
                    </h3>
                    {renderStatusBadge(
                      actuatorStemResult.actuatorMarginBalancedPct >= 0 ? 'PASS' : 'CRITICAL',
                      `${actuatorStemResult.actuatorMarginBalancedPct > 0 ? '+' : ''}${
                        actuatorStemResult.actuatorMarginBalancedPct
                      }% Margin`
                    )}
                  </div>
                  <div className="p-4">
                    <div className="instrument-panel rounded-lg p-3 space-y-1.5 text-xs">
                      <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between text-slate-300">
                        <span>Force A (Balanced Annulus):</span>
                        <span className="text-[#8be0a8] font-semibold">
                          {actuatorStemResult.balanced.fluidUnbalanceForceA_N.toLocaleString()} N
                        </span>
                      </div>
                      <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between text-slate-300">
                        <span>Force B (FCI 70-2 Seat Load):</span>
                        <span className="text-slate-100">{actuatorStemResult.balanced.seatLoadForceB_N.toLocaleString()} N</span>
                      </div>
                      <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between text-slate-300">
                        <span>Force C (Packing Friction):</span>
                        <span className="text-slate-100">{actuatorStemResult.balanced.packingFrictionForceC_N.toLocaleString()} N</span>
                      </div>
                      <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between text-slate-300">
                        <span>Force D (Balance Seal + Bellows):</span>
                        <span className="text-slate-100">{actuatorStemResult.balanced.sealAndBellowsForceD_N.toLocaleString()} N</span>
                      </div>
                      <div className="border-t border-[#2f3b47] pt-2 px-1 flex justify-between font-bold text-sm text-[#7fe0e2]">
                        <span>Required Thrust (1.25x SF):</span>
                        <span>{actuatorStemResult.balanced.totalWithSafetyMargin_N.toLocaleString()} N</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Operational Stem Structural & Euler Buckling Verification Card */}
              <div className="dy-card overflow-hidden">
                <div className="section-band px-5 py-3.5 flex items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Operational Stem Diameter & Euler Column Buckling Verification
                    </h3>
                    <p className="text-xs text-slate-300 font-mono">
                      Evaluates thread-root tensile stress, compressive yield, and slender column buckling (SF ≥ 2.5)
                    </p>
                  </div>
                  {renderStatusBadge(actuatorStemResult.stemStructuralStatus)}
                </div>

                <div className="p-5">
                  <div className="instrument-panel rounded-xl p-3 grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
                    <div className="instrument-tile p-3 rounded-lg">
                      <span className="block text-[10px] text-slate-400 uppercase">
                        Available Seating Thrust
                      </span>
                      <span className="text-sm font-bold text-[#7fe0e2]">
                        {actuatorStemResult.availableActuatorSeatingThrust_N.toLocaleString()} N
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        Rec Area: {actuatorStemResult.recommendedActuatorArea_cm2} cm²
                      </span>
                    </div>

                    <div className="instrument-tile p-3 rounded-lg">
                      <span className="block text-[10px] text-slate-400 uppercase">
                        Root Tensile Stress
                      </span>
                      <span className="text-sm font-bold text-[#ffd77a]">
                        {actuatorStemResult.directTensileStress_MPa} MPa
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        Allowable Sm: {actuatorStemResult.allowableTensileSm_MPa} MPa
                      </span>
                    </div>

                    <div className="instrument-tile p-3 rounded-lg">
                      <span className="block text-[10px] text-slate-400 uppercase">
                        Euler Critical Buckling P_cr
                      </span>
                      <span className="text-sm font-bold text-[#8be0a8]">
                        {(actuatorStemResult.eulerCriticalBucklingLoad_N / 1000).toFixed(1)} kN
                      </span>
                      <span className="block text-[10px] text-slate-400">
                        Buckling SF = {actuatorStemResult.bucklingSafetyFactor}x (KL/r ={' '}
                        {actuatorStemResult.slendernessRatioKL_r})
                      </span>
                    </div>

                    <div className="instrument-tile p-3 rounded-lg">
                      <span className="block text-[10px] text-slate-400 uppercase">
                        Min Required Stem Ø
                      </span>
                      <span className="text-sm font-bold text-[#7fe0e2]">
                        {actuatorStemResult.minRequiredStemDia_mm} mm
                      </span>
                      <span className="block text-[10px] text-[#8be0a8]">
                        Std Schedule: Ø{actuatorStemResult.recommendedStandardStem_mm} mm
                      </span>
                    </div>
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
            <div className="dy-card overflow-hidden">
              <div className="section-band px-5 py-3.5">
                <h2 className="text-sm font-bold text-white">
                  Universal Manufacturer-Agnostic Control Valve Correlation Equations (IEC 60534 / ISA-75)
                </h2>
              </div>
              <div className="p-5">
                <div className="instrument-panel rounded-xl p-3 grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
                  <div className="instrument-tile p-3.5 rounded-lg">
                    <span className="text-[#7fe0e2] font-bold block mb-1">
                      1. Specific Capacity Index (Cd = Cv / d²)
                    </span>
                    <p className="text-[#ffd77a]">
                      Cv_rated = Cd · K_class · K_body · F_reduced · d_in²
                    </p>
                    <p className="text-slate-400 text-[11px] mt-1">
                      Contoured Linear Cd≈16.0 | Contoured Eq% Cd≈14.0 | 1-Stage Drilled Cage Cd≈11.5 | 2-Stage Cd≈8.0 | 3-Stage Cd≈5.0
                    </p>
                  </div>
                  <div className="instrument-tile p-3.5 rounded-lg">
                    <span className="text-[#8be0a8] font-bold block mb-1">
                      2. Curtain-to-Seat Stroke Rule (H vs. d_port)
                    </span>
                    <p className="text-[#ffd77a]">
                      A_curtain = π · d_port · H · η_open ≥ (π/4) · d_port²
                    </p>
                    <p className="text-slate-400 text-[11px] mt-1">
                      Requires H / d_port ≥ 1 / (4 · η_open). Multi-stage drilled cages use Extended Stroke H_ext to recover full seat capacity.
                    </p>
                  </div>
                  <div className="instrument-tile p-3.5 rounded-lg">
                    <span className="text-[#7fe0e2] font-bold block mb-1">
                      3. Composite Series-Resistance Cv_total
                    </span>
                    <p className="text-[#ffd77a]">
                      1 / Cv_rated² = 1 / Cv_trim² + 1 / Cv_seat² + 1 / Cv_body²
                    </p>
                    <p className="text-slate-400 text-[11px] mt-1">
                      Couples physical drilled orifice area (A_holes) in series with Seat Port Bore and Body Gallery losses.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Interactive Master Schedule Table (DN15 to DN600) */}
            <div className="dy-card overflow-hidden">
              <div className="section-band px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Standardized Generic Control Valve Master Schedule (DN15 / 1/2" to DN600 / 24")
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    Click any row to load that valve size directly into the active CAE workbench
                  </p>
                </div>
                <span className="text-xs font-mono text-[#ffd77a] bg-[#182028] px-2.5 py-1 rounded border border-[#2f3b47]">
                  Active Class Multiplier K_class ={' '}
                  {PRESSURE_CLASSES[pressureClass].capacityMultiplierKClass.toFixed(2)} (
                  {PRESSURE_CLASSES[pressureClass].label})
                </span>
              </div>

              <div className="p-5 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#cfd8e3] text-[#13315c] bg-[#edf1f5]">
                      <th className="py-2.5 px-3">Size (DN / NPS)</th>
                      <th className="py-2.5 px-2">Seat Bore Ød_port</th>
                      <th className="py-2.5 px-2">Std Stroke H_std</th>
                      <th className="py-2.5 px-2">Ext Stroke H_ext</th>
                      <th className="py-2.5 px-2">Stem Ø (Std/Hvy)</th>
                      <th className="py-2.5 px-2">Min Body Wall ({pressureClass.split('_')[0]})</th>
                      <th className="py-2.5 px-2">Contoured Lin Cv</th>
                      <th className="py-2.5 px-2">Contoured Eq% Cv</th>
                      <th className="py-2.5 px-2 text-[#0f8b8d]">1-Stage Cage Cv</th>
                      <th className="py-2.5 px-2 text-emerald-700">2-Stage Cage Cv</th>
                      <th className="py-2.5 px-2 text-amber-700">3-Stage / Tortuous Cv</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
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
                              ? 'bg-[#0f8b8d]/10 border-l-4 border-[#0f8b8d]'
                              : 'hover:bg-[#f8fafc]'
                          }`}
                        >
                          <td className="py-2.5 px-3 font-bold text-[#0b2545]">
                            DN{s.dn} ({s.npsLabel})
                          </td>
                          <td className="py-2.5 px-2 text-slate-700">
                            {s.d_port_mm} mm ({s.d_port_in}")
                          </td>
                          <td className="py-2.5 px-2 text-slate-700">
                            {s.strokeStd_mm} mm ({s.strokeStd_in}")
                          </td>
                          <td className="py-2.5 px-2 text-slate-500">
                            {s.strokeExt_mm} mm ({s.strokeExt_in}")
                          </td>
                          <td className="py-2.5 px-2 text-slate-700">
                            Ø{s.stemDiaStd_mm} / Ø{s.stemDiaHeavy_mm} mm
                          </td>
                          <td className="py-2.5 px-2 text-slate-700">
                            {s.bodyMinWall_mm[pressureClass]} mm
                          </td>
                          <td className="py-2.5 px-2 text-[#0b2545]">
                            {(s.ratedCvBaseline.CONTOURED_LINEAR * kClass).toFixed(1)}
                          </td>
                          <td className="py-2.5 px-2 text-[#0b2545]">
                            {(s.ratedCvBaseline.CONTOURED_EQP * kClass).toFixed(1)}
                          </td>
                          <td className="py-2.5 px-2 font-bold text-[#0f8b8d]">
                            {(s.ratedCvBaseline.CAGE_1STAGE * kClass).toFixed(1)}
                          </td>
                          <td className="py-2.5 px-2 font-bold text-emerald-700">
                            {(s.ratedCvBaseline.CAGE_2STAGE * kClass).toFixed(1)}
                          </td>
                          <td className="py-2.5 px-2 font-bold text-amber-700">
                            {(s.ratedCvBaseline.CAGE_3STAGE * kClass).toFixed(1)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ROTARY & QUARTER-TURN CONTROL VALVE BENCHMARK COMPARISON (WARREN / BAUMANN / CED / NELES) */}
            <div className="dy-card overflow-hidden">
              <div className="section-band px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#0b2545] border border-[#f2a900]/60 flex items-center justify-center text-[#7fe0e2]">
                    <Gauge className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white">
                      Rotary & Quarter-Turn Control Valve Benchmark Reference (DN{selectedDN} / {PRESSURE_CLASSES[pressureClass].label})
                    </h2>
                    <p className="text-xs text-slate-300 font-mono">
                      Typical wide-open specific capacity Cd = Cv/d² and low-recovery factors vs linear globe/cage valves (Warren / Baumann Ch. 5 / Neles)
                    </p>
                  </div>
                </div>
              </div>
              <div className="p-5 overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b border-[#cfd8e3] text-[#13315c] bg-[#edf1f5]">
                      <th className="py-2.5 px-3">Rotary Valve Style</th>
                      <th className="py-2.5 px-2">Motion / Geometry</th>
                      <th className="py-2.5 px-2">Cd (Cv/in²)</th>
                      <th className="py-2.5 px-2 text-[#0f8b8d]">Est. DN{selectedDN} Rated Cv</th>
                      <th className="py-2.5 px-2">FL (90°)</th>
                      <th className="py-2.5 px-2">Kc (90°)</th>
                      <th className="py-2.5 px-2">xT (90°)</th>
                      <th className="py-2.5 px-2">Fd</th>
                      <th className="py-2.5 px-2">Rangeability R</th>
                      <th className="py-2.5 px-2">Characteristic</th>
                      <th className="py-2.5 px-3">Service Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#e2e8f0]">
                    {ROTARY_VALVE_BENCHMARKS.map((b) => {
                      const dIn = correlatedValve.d_mm / 25.4;
                      const estCv = Math.round(
                        b.cdSpecificCapacity *
                          dIn *
                          dIn *
                          PRESSURE_CLASSES[pressureClass].capacityMultiplierKClass
                      );
                      return (
                        <tr key={b.id} className="hover:bg-[#f8fafc]">
                          <td className="py-2.5 px-3 font-bold text-[#0b2545]">{b.styleName}</td>
                          <td className="py-2.5 px-2 text-slate-600">{b.motionType}</td>
                          <td className="py-2.5 px-2 text-[#0b2545]">{b.cdSpecificCapacity.toFixed(1)}</td>
                          <td className="py-2.5 px-2 font-bold text-[#0f8b8d]">{estCv} Cv</td>
                          <td className="py-2.5 px-2">{b.FL_90deg.toFixed(2)}</td>
                          <td className="py-2.5 px-2">{b.Kc_90deg.toFixed(2)}</td>
                          <td className="py-2.5 px-2">{b.xT_90deg.toFixed(2)}</td>
                          <td className="py-2.5 px-2">{b.Fd_typical.toFixed(2)}</td>
                          <td className="py-2.5 px-2 font-semibold text-emerald-700">{b.rangeability}</td>
                          <td className="py-2.5 px-2 text-slate-700">{b.characteristic}</td>
                          <td className="py-2.5 px-3 text-slate-600 text-[11px] min-w-[260px]">
                            {b.notes}
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

      {/* GLOBAL VALVE HARDWARE & CORRELATION BANNER (BELOW MAIN TABS) */}
      <section className="bg-[#edf1f5] border-t border-[#cfd8e3] px-6 py-4">
        <div className="max-w-[1600px] mx-auto space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {/* Nominal Valve Size */}
            <div className="bg-white rounded-lg p-2.5 border border-[#cfd8e3] shadow-sm">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-[#13315c] font-semibold mb-1">
                Nominal Valve Size (DN / NPS)
              </label>
              <select
                value={selectedDN}
                onChange={(e) => handleSelectSizeFromSchedule(Number(e.target.value))}
                className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] font-semibold focus:border-[#0f8b8d] focus:outline-none"
              >
                {GENERIC_VALVE_SCHEDULE.map((s) => (
                  <option key={s.dn} value={s.dn}>
                    DN{s.dn} ({s.npsLabel}) — Bore Ø{s.d_port_mm}mm
                  </option>
                ))}
              </select>
            </div>

            {/* Pressure Rating Class */}
            <div className="bg-white rounded-lg p-2.5 border border-[#cfd8e3] shadow-sm">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-[#13315c] font-semibold mb-1">
                Pressure Class (ASME / PN)
              </label>
              <select
                value={pressureClass}
                onChange={(e) => setPressureClass(e.target.value as PressureClassId)}
                className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] font-semibold focus:border-[#0f8b8d] focus:outline-none"
              >
                {Object.values(PRESSURE_CLASSES).map((pc) => (
                  <option key={pc.id} value={pc.id}>
                    {pc.label} (K_class={pc.capacityMultiplierKClass.toFixed(2)})
                  </option>
                ))}
              </select>
            </div>

            {/* Generic Trim Family */}
            <div className="bg-white rounded-lg p-2.5 border border-[#cfd8e3] shadow-sm">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-[#13315c] font-semibold mb-1">
                Generic Trim Style & Stages
              </label>
              <select
                value={trimStyle}
                onChange={(e) => setTrimStyle(e.target.value as TrimStyleId)}
                className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
              >
                {Object.values(TRIM_STYLES).map((ts) => (
                  <option key={ts.id} value={ts.id}>
                    {ts.shortName} (Cd≈{ts.cdSpecificCapacity})
                  </option>
                ))}
              </select>
            </div>

            {/* Reduced Trim Capacity Step */}
            <div className="bg-white rounded-lg p-2.5 border border-[#cfd8e3] shadow-sm">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-[#13315c] font-semibold mb-1">
                Trim Capacity Factor (R5 Series)
              </label>
              <select
                value={reducedTrimFactor}
                onChange={(e) => {
                  setReducedTrimFactor(Number(e.target.value));
                  setCustomBoreOverride(null);
                  setCustomRatedCvOverride(null);
                }}
                className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] font-semibold focus:border-[#0f8b8d] focus:outline-none"
              >
                {REDUCED_TRIM_FACTORS.map((rf) => (
                  <option key={rf.factor} value={rf.factor}>
                    {rf.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Body Pattern & Flow Direction */}
            <div className="bg-white rounded-lg p-2.5 border border-[#cfd8e3] shadow-sm">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-[#13315c] font-semibold mb-1">
                Body Style & Flow Direction
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  value={bodyStyle}
                  onChange={(e) => setBodyStyle(e.target.value as BodyStyleId)}
                  className="bg-white border border-[#cfd8e3] rounded px-2 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none"
                >
                  <option value="GLOBE_STRAIGHT">Globe (1.0x)</option>
                  <option value="ANGLE_BODY">Angle (1.12x)</option>
                </select>
                <select
                  value={flowDirection}
                  onChange={(e) => setFlowDirection(e.target.value as FlowDirectionId)}
                  className="bg-white border border-[#cfd8e3] rounded px-2 py-1.5 text-xs font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none"
                >
                  <option value="FTC">FTC (Over)</option>
                  <option value="FTO">FTO (Under)</option>
                </select>
              </div>
            </div>

            {/* Stroke Mode (Standard vs Extended) */}
            <div className="bg-white rounded-lg p-2.5 border border-[#cfd8e3] shadow-sm">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-[#13315c] font-semibold mb-1">
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
                      ? 'bg-[#0f8b8d] text-white border-[#0f8b8d] font-semibold'
                      : 'bg-white text-[#13315c] border-[#cfd8e3] hover:bg-[#edf1f5]'
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
                      ? 'bg-[#0f8b8d] text-white border-[#0f8b8d] font-semibold'
                      : 'bg-white text-[#13315c] border-[#cfd8e3] hover:bg-[#edf1f5]'
                  }`}
                >
                  Ext Stroke
                </button>
              </div>
            </div>
          </div>

          {/* LIVE CORRELATED HARDWARE KPI READOUT STRIP (DARK INSTRUMENT PANEL) */}
          <div className="instrument-panel rounded-xl p-2.5 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
            <div className="instrument-tile rounded-lg px-3 py-2">
              <span className="block text-[10px] font-mono text-slate-400 uppercase">
                Correlated Rated Cv / Kv
              </span>
              <span className="text-sm font-mono font-bold text-[#7fe0e2]">
                {correlatedValve.ratedCv} Cv{' '}
                <span className="text-xs text-slate-400 font-normal">
                  ({correlatedValve.ratedKv} Kv)
                </span>
              </span>
            </div>

            <div className="instrument-tile rounded-lg px-3 py-2">
              <span className="block text-[10px] font-mono text-slate-400 uppercase">
                Specific Capacity Cd (Cv/d²)
              </span>
              <span className="text-sm font-mono font-bold text-[#ffd77a]">
                {correlatedValve.effectiveCd}{' '}
                <span className="text-xs text-slate-400 font-normal">Cv/in²</span>
              </span>
            </div>

            <div className="instrument-tile rounded-lg px-3 py-2">
              <span className="block text-[10px] font-mono text-slate-400 uppercase">
                Seat Port Bore Ød_port
              </span>
              <span className="text-sm font-mono font-bold text-[#7fe0e2]">
                {correlatedValve.d_port_mm} mm{' '}
                <span className="text-xs text-slate-400 font-normal">
                  ({correlatedValve.d_port_in}")
                </span>
              </span>
            </div>

            <div className="instrument-tile rounded-lg px-3 py-2">
              <span className="block text-[10px] font-mono text-slate-400 uppercase">
                Rated Stroke H (Curtain Ratio)
              </span>
              <span className="text-sm font-mono font-bold text-[#ffd77a]">
                {correlatedValve.stroke_mm} mm{' '}
                <span className="text-xs text-[#7fe0e2] font-normal">
                  ({correlatedValve.curtainToSeatAreaRatio}x Seat)
                </span>
              </span>
            </div>

            <div className="instrument-tile rounded-lg px-3 py-2">
              <span className="block text-[10px] font-mono text-slate-400 uppercase">
                Series Cv (Trim / Seat / Body)
              </span>
              <span className="text-xs font-mono font-semibold text-slate-200">
                {correlatedValve.cvTrimComponent} / {correlatedValve.cvSeatComponent} /{' '}
                {correlatedValve.cvBodyComponent}
              </span>
            </div>

            <div className="instrument-tile rounded-lg px-3 py-2">
              <span className="block text-[10px] font-mono text-slate-400 uppercase">
                Recovery Factors (FL / Kc / xT)
              </span>
              <span className="text-sm font-mono font-bold text-[#8be0a8]">
                {correlatedValve.FL} / {correlatedValve.Kc} / {correlatedValve.xT}
              </span>
            </div>

            <div className="instrument-tile rounded-lg px-3 py-2">
              <span className="block text-[10px] font-mono text-slate-400 uppercase">
                ASME Min Body Wall t_body
              </span>
              <span className="text-sm font-mono font-bold text-[#ffd77a]">
                {correlatedValve.bodyMinWall_mm} mm
              </span>
            </div>

            <div className="instrument-tile rounded-lg px-3 py-2">
              <span className="block text-[10px] font-mono text-slate-400 uppercase">
                Synthesized Cage Orifices
              </span>
              <span className="text-sm font-mono font-bold text-[#7fe0e2]">
                {cageSynthesis.totalHoles} holes{' '}
                <span className="text-xs text-slate-400 font-normal">
                  (Ø{cageSynthesis.meanHoleDia_mm}mm)
                </span>
              </span>
            </div>
          </div>

          {/* SEGMENTED WORKBENCH MODE SWITCHER */}
          <div className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-xl border border-[#cfd8e3] shadow-sm no-print">
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
                      ? 'bg-[#0f8b8d] text-white font-semibold shadow-sm'
                      : 'text-[#13315c] hover:text-[#0b2545] hover:bg-[#edf1f5]'
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
    </div>
  );
}
