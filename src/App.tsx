import React, { useState, useMemo, useRef, useEffect, useId } from 'react';
import {
  Activity,
  Sliders,
  Cpu,
  Thermometer,
  ShieldAlert,
  Table,
  Download,
  FileCode,
  FileText,
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
  ChevronUp,
  Upload,
  Save,
  Globe,
  Link2,
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
  SizingMethodologyMode,
  TrimManufacturingProcessId,
  TRIM_MANUFACTURING_PROCESSES,
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

import {
  BODY_MATERIAL_GROUPS,
  BodyMaterialGroupId,
  EndConnectionId,
  evaluateAsmeB1634Rating,
  evaluateNaceScreening,
  evaluateFugitiveEmissions,
  evaluatePipingAndBodyStandards,
  evaluateSilAndPositioner,
} from './engine/industryStandards';

// Application revision displayed in the header title bar & browser tab.
// Increment by +0.0.1 on every subsequent code change/push (next: 1.0.9) unless minor/major escalation is requested.
export const APP_VERSION = '1.0.8';

/**
 * Top-layer, viewport-aware tooltip satisfying WCAG 1.4.13 (hoverable, persistent, Escape-dismissible).
 * Uses native Popover API when available and fixed viewport coordinates to avoid overflow-x-auto clipping.
 */
const InfoTooltip: React.FC<{
  label: string;
  text: string;
  placement?: 'bottom' | 'top';
  align?: 'left' | 'right';
}> = ({ label, text, placement = 'bottom', align = 'left' }) => {
  const tooltipId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 });

  const updatePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = 256;
    const margin = 8;
    const rawLeft = align === 'right' ? rect.right - width : rect.left;
    const left = Math.max(margin, Math.min(rawLeft, window.innerWidth - width - margin));
    const top =
      placement === 'top'
        ? Math.max(margin, rect.top - 8)
        : Math.min(window.innerHeight - margin, rect.bottom + 6);
    setCoords({ top, left });
  };

  const openTooltip = () => {
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    updatePosition();
    setIsOpen(true);
    const el = popoverRef.current as (HTMLDivElement & { showPopover?: () => void }) | null;
    if (el && typeof el.showPopover === 'function') {
      try {
        if (!el.matches(':popover-open')) el.showPopover();
      } catch {
        // Fallback to React state positioning when Popover API is unavailable
      }
    }
  };

  const closeTooltip = () => {
    setIsOpen(false);
    const el = popoverRef.current as (HTMLDivElement & { hidePopover?: () => void }) | null;
    if (el && typeof el.hidePopover === 'function') {
      try {
        if (el.matches(':popover-open')) el.hidePopover();
      } catch {
        // Ignore if already closed
      }
    }
  };

  const scheduleClose = () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => closeTooltip(), 120);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeTooltip();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen]);

  return (
    <span className="relative inline-flex items-center shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`${label}: more info`}
        aria-describedby={isOpen ? tooltipId : undefined}
        aria-expanded={isOpen}
        onMouseEnter={openTooltip}
        onMouseLeave={scheduleClose}
        onFocus={openTooltip}
        onBlur={scheduleClose}
        onClick={() => (isOpen ? closeTooltip() : openTooltip())}
        className="p-0.5 rounded-full text-[#0f8b8d] hover:bg-[#0f8b8d]/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d] transition"
      >
        <Info className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      <div
        ref={popoverRef}
        id={tooltipId}
        role="tooltip"
        {...({ popover: 'auto' } as Record<string, string>)}
        onMouseEnter={openTooltip}
        onMouseLeave={scheduleClose}
        style={{
          position: 'fixed',
          top: `${coords.top}px`,
          left: `${coords.left}px`,
          transform: placement === 'top' ? 'translateY(-100%)' : undefined,
        }}
        className={`${
          isOpen ? 'block' : 'hidden'
        } z-[90] w-64 p-2.5 rounded-lg bg-[#0f1419] text-slate-200 border border-[#2f3b47] shadow-2xl text-[11px] font-sans font-normal leading-snug whitespace-normal`}
      >
        {text}
      </div>
    </span>
  );
};

type ActiveTabId =
  | 'PROCESS_SIZING'
  | 'CHARACTERISTICS'
  | 'CAGE_CAD_STRESS'
  | 'TRANSIENT_THERMAL'
  | 'ACTUATOR_STEM'
  | 'MASTER_SCHEDULE';

interface AsmePipeScheduleOption {
  id: string;
  label: string;
  dn: number;
  pipeID_mm: number;
  wall_mm: number;
}

const ASME_PIPE_SCHEDULES: AsmePipeScheduleOption[] = [
  { id: '1_SCH40', label: '1" (DN25) Sch 40 / Std (ID 26.6 mm)', dn: 25, pipeID_mm: 26.6, wall_mm: 3.38 },
  { id: '1_SCH80', label: '1" (DN25) Sch 80 / XS (ID 24.3 mm)', dn: 25, pipeID_mm: 24.3, wall_mm: 4.55 },
  { id: '1_5_SCH40', label: '1.5" (DN40) Sch 40 / Std (ID 40.9 mm)', dn: 40, pipeID_mm: 40.9, wall_mm: 3.68 },
  { id: '1_5_SCH80', label: '1.5" (DN40) Sch 80 / XS (ID 38.1 mm)', dn: 40, pipeID_mm: 38.1, wall_mm: 5.08 },
  { id: '2_SCH40', label: '2" (DN50) Sch 40 / Std (ID 52.5 mm)', dn: 50, pipeID_mm: 52.5, wall_mm: 3.91 },
  { id: '2_SCH80', label: '2" (DN50) Sch 80 / XS (ID 49.2 mm)', dn: 50, pipeID_mm: 49.2, wall_mm: 5.54 },
  { id: '3_SCH40', label: '3" (DN80) Sch 40 / Std (ID 77.9 mm)', dn: 80, pipeID_mm: 77.9, wall_mm: 5.49 },
  { id: '3_SCH80', label: '3" (DN80) Sch 80 / XS (ID 73.7 mm)', dn: 80, pipeID_mm: 73.7, wall_mm: 7.62 },
  { id: '4_SCH40', label: '4" (DN100) Sch 40 / Std (ID 102.3 mm)', dn: 100, pipeID_mm: 102.3, wall_mm: 6.02 },
  { id: '4_SCH80', label: '4" (DN100) Sch 80 / XS (ID 97.2 mm)', dn: 100, pipeID_mm: 97.2, wall_mm: 8.56 },
  { id: '6_SCH40', label: '6" (DN150) Sch 40 / Std (ID 154.1 mm)', dn: 150, pipeID_mm: 154.1, wall_mm: 7.11 },
  { id: '6_SCH80', label: '6" (DN150) Sch 80 / XS (ID 146.3 mm)', dn: 150, pipeID_mm: 146.3, wall_mm: 10.97 },
  { id: '8_SCH40', label: '8" (DN200) Sch 40 / Std (ID 202.7 mm)', dn: 200, pipeID_mm: 202.7, wall_mm: 8.18 },
  { id: '8_SCH80', label: '8" (DN200) Sch 80 / XS (ID 193.7 mm)', dn: 200, pipeID_mm: 193.7, wall_mm: 12.70 },
  { id: '10_SCH40', label: '10" (DN250) Sch 40 / Std (ID 254.5 mm)', dn: 250, pipeID_mm: 254.5, wall_mm: 9.27 },
  { id: '10_SCH80', label: '10" (DN250) Sch 80 (ID 242.9 mm)', dn: 250, pipeID_mm: 242.9, wall_mm: 15.09 },
  { id: '12_STD', label: '12" (DN300) Std (ID 304.8 mm)', dn: 300, pipeID_mm: 304.8, wall_mm: 9.53 },
  { id: '12_SCH40', label: '12" (DN300) Sch 40 (ID 303.2 mm)', dn: 300, pipeID_mm: 303.2, wall_mm: 10.31 },
  { id: '12_SCH80', label: '12" (DN300) Sch 80 (ID 288.9 mm)', dn: 300, pipeID_mm: 288.9, wall_mm: 17.48 },
  { id: '16_STD', label: '16" (DN400) Std (ID 387.4 mm)', dn: 400, pipeID_mm: 387.4, wall_mm: 9.53 },
  { id: '16_SCH40', label: '16" (DN400) Sch 40 / XS (ID 381.0 mm)', dn: 400, pipeID_mm: 381.0, wall_mm: 12.70 },
  { id: '16_SCH80', label: '16" (DN400) Sch 80 (ID 363.5 mm)', dn: 400, pipeID_mm: 363.5, wall_mm: 21.44 },
  { id: '20_STD', label: '20" (DN500) Std / Sch 20 (ID 488.9 mm)', dn: 500, pipeID_mm: 488.9, wall_mm: 9.53 },
  { id: '20_SCH40', label: '20" (DN500) Sch 40 (ID 477.8 mm)', dn: 500, pipeID_mm: 477.8, wall_mm: 15.09 },
  { id: '20_SCH80', label: '20" (DN500) Sch 80 (ID 455.6 mm)', dn: 500, pipeID_mm: 455.6, wall_mm: 26.19 },
  { id: '24_STD', label: '24" (DN600) Std / Sch 20 (ID 590.5 mm)', dn: 600, pipeID_mm: 590.5, wall_mm: 9.53 },
  { id: '24_SCH40', label: '24" (DN600) Sch 40 (ID 574.6 mm)', dn: 600, pipeID_mm: 574.6, wall_mm: 17.48 },
  { id: '24_SCH80', label: '24" (DN600) Sch 80 (ID 547.7 mm)', dn: 600, pipeID_mm: 547.7, wall_mm: 30.96 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTabId>('PROCESS_SIZING');

  // General Unit System ('METRIC' | 'ENGLISH') and granular row-level process unit selections
  const [unitSystem, setUnitSystem] = useState<GeneralUnitSystem>('METRIC');
  const [processUnits, setProcessUnits] = useState<ProcessUnitsState>(DEFAULT_METRIC_UNITS);

  // Tools menu dropdown toggle
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState<boolean>(false);
  const toolsMenuRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Close tools menu on outside click or Escape key
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
        setIsToolsMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isToolsMenuOpen) {
        setIsToolsMenuOpen(false);
        const btn = toolsMenuRef.current?.querySelector('button');
        btn?.focus();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isToolsMenuOpen]);

  // Keep browser tab title synchronized with APP_VERSION
  useEffect(() => {
    document.title = `DY-SIZE (Rev ${APP_VERSION}) // Control Valve Sizing & Drilled Cage CAE Suite (IEC 60534 / ASME B16.34)`;
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

  // Workbench UI, Project Metadata & Cross-Tab Sync State
  const [showHardwareKpis, setShowHardwareKpis] = useState<boolean>(true);
  const [showCandidateComparison, setShowCandidateComparison] = useState<boolean>(false);
  const [showGCodePreview, setShowGCodePreview] = useState<boolean>(false);
  const [pipeScheduleId, setPipeScheduleId] = useState<string>('4_SCH40');
  const [autoSyncPv, setAutoSyncPv] = useState<boolean>(true);
  const [syncThermalTempWithProcess, setSyncThermalTempWithProcess] = useState<boolean>(true);
  const [customShutoffDeltaP_bar, setCustomShutoffDeltaP_bar] = useState<number | null>(null);
  const [projectMeta, setProjectMeta] = useState({
    tagNumber: 'FV-1001A',
    serviceDescription: 'HP Boiler Feedwater Letdown',
    lineNumber: '4"-BFW-104-CL300',
    projectRev: 'Rev A',
  });

  // 2. Piping & Multi-Condition Process State
  const [piping, setPiping] = useState<PipingConfiguration>({
    upstreamPipeID_mm: 102.3, // 4" Sch 40
    downstreamPipeID_mm: 102.3,
    pipeWallThickness_mm: 6.02,
    upstreamPipeLength_m: 85,
    actuatorCloseTime_s: 3.5,
    bodyMaterialCategory: 'STAINLESS_ALLOY',
    desuperheaterEnabled: false,
    sprayWaterTemp_degC: 105,
    sprayWaterPressure_bar_a: 60,
    targetDownstreamTemp_degC: 240,
    downstreamDiffuserEnabled: false,
    diffuserCv: 450,
    diffuserXt: 0.65,
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

  // 4. Drilled Cage Synthesis, Local 3D Methodology & Hoop Stress State
  const [methodologyMode, setMethodologyMode] = useState<SizingMethodologyMode>('ADVANCED_LOCAL_3D');
  const [manufacturingProcess, setManufacturingProcess] = useState<TrimManufacturingProcessId>('CNC_DRILLED');
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
  const [numConcentricStages, setNumConcentricStages] = useState<1 | 2 | 3 | 4>(1);
  const [compensateGalleryAsymmetry, setCompensateGalleryAsymmetry] = useState<boolean>(false);

  const handleMethodologyModeChange = (mode: SizingMethodologyMode) => {
    setMethodologyMode(mode);
    if (mode === 'CONVENTIONAL_1D') {
      setModulateHoleDiameter(false);
      setEnforceZeroDeadbandOverlap(false);
      setCompensateGalleryAsymmetry(false);
      setShowSibandaGalleryHeatmap(false);
      setManufacturingProcess('CNC_DRILLED');
    } else {
      setModulateHoleDiameter(true);
      setEnforceZeroDeadbandOverlap(true);
      setCompensateGalleryAsymmetry(true);
      setShowSibandaGalleryHeatmap(true);
    }
  };

  // Industry Standards & Body/Safety Specifications State
  const [bodyMaterial, setBodyMaterial] = useState<BodyMaterialGroupId>('WCB_1_1');
  const [endConnection, setEndConnection] = useState<EndConnectionId>('RF_FLANGED');
  const [h2sPartialPressure_bar, setH2sPartialPressure_bar] = useState<number>(0);
  const [chloride_ppm, setChloride_ppm] = useState<number>(50);
  const [fireSafeRequired, setFireSafeRequired] = useState<boolean>(false);
  const [silServiceEnabled, setSilServiceEnabled] = useState<boolean>(false);
  const [targetSilLevel, setTargetSilLevel] = useState<'NONE' | 'SIL_1' | 'SIL_2' | 'SIL_3'>('NONE');

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

  // Compute downstream backpressure orifice pressure sharing FIRST so P_mid (P2*) feeds active sizing
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

  // Closed-loop operating cases: when orifice sharing is active, substitute valve outlet P2 with P_mid
  const effectiveOperatingCases = useMemo(() => {
    if (!enableBackpressureOrifice || !backpressureOrificeResult) return operatingCases;
    return operatingCases.map((c) => {
      const share = backpressureOrificeResult.caseShares.find((s) => s.id === c.id);
      return share ? { ...c, P2_bar_a: share.midPressurePmid_bar_a } : c;
    });
  }, [operatingCases, enableBackpressureOrifice, backpressureOrificeResult]);

  // Shutoff ΔP against atmospheric downstream (0 bar g = 1.013 bar a) unless overridden by user
  const maxUpstreamP1_bar_a = useMemo(
    () => Math.max(...operatingCases.map((c) => c.P1_bar_a), 26.013),
    [operatingCases]
  );

  const defaultShutoffDeltaP_bar = useMemo(
    () => Math.max(1, Number((maxUpstreamP1_bar_a - 1.013).toFixed(1))),
    [maxUpstreamP1_bar_a]
  );

  const effectiveShutoffDeltaP_bar = useMemo(
    () =>
      customShutoffDeltaP_bar !== null
        ? Math.max(0.5, customShutoffDeltaP_bar)
        : defaultShutoffDeltaP_bar,
    [customShutoffDeltaP_bar, defaultShutoffDeltaP_bar]
  );

  const maxShutoffDeltaP_bar = effectiveShutoffDeltaP_bar;

  // Auto-derive Valve Authority Pv = ΔP_min / ΔP_max across enabled operating cases
  const derivedSystemPv = useMemo(() => {
    const active = effectiveOperatingCases.filter((c) => c.enabled && c.P1_bar_a > c.P2_bar_a);
    if (active.length === 0) return charConfig.valveAuthorityPv;
    const dps = active.map((c) => c.P1_bar_a - c.P2_bar_a);
    const minDp = Math.min(...dps);
    const maxDp = Math.max(...dps);
    if (maxDp <= 0 || Math.abs(maxDp - minDp) < 0.05) {
      return charConfig.valveAuthorityPv;
    }
    return Number(Math.min(0.95, Math.max(0.08, minDp / maxDp)).toFixed(2));
  }, [effectiveOperatingCases, charConfig.valveAuthorityPv]);

  const effectiveCharConfig = useMemo<CharacteristicConfig>(
    () => ({
      ...charConfig,
      valveAuthorityPv: autoSyncPv ? derivedSystemPv : charConfig.valveAuthorityPv,
    }),
    [charConfig, autoSyncPv, derivedSystemPv]
  );

  // Sync thermal shock final temperature with extreme process temperature (handles both hot & cryogenic cases)
  const processExtremeTemp_degC = useMemo(() => {
    const active = operatingCases.filter((c) => c.enabled);
    if (active.length === 0) return finalProcessTemp_degC;
    let extreme = active[0].T1_degC;
    for (const c of active) {
      if (Math.abs(c.T1_degC - 20) > Math.abs(extreme - 20)) {
        extreme = c.T1_degC;
      }
    }
    return Number(extreme.toFixed(1));
  }, [operatingCases, finalProcessTemp_degC]);

  const effectiveThermalTargetTemp_degC = syncThermalTempWithProcess
    ? processExtremeTemp_degC
    : finalProcessTemp_degC;

  const maxOperatingTemp_degC = useMemo(() => {
    return Math.max(...operatingCases.map((c) => c.T1_degC), effectiveThermalTargetTemp_degC);
  }, [operatingCases, effectiveThermalTargetTemp_degC]);

  const nextSmallerValveInfo = useMemo(() => {
    const sorted = [...GENERIC_VALVE_SCHEDULE].sort((a, b) => a.dn - b.dn);
    const idx = sorted.findIndex((s) => s.dn === selectedDN);
    if (idx <= 0) return { ratedCv: undefined, label: undefined };
    const smaller = sorted[idx - 1];
    const corr = computeCorrelatedValveParameters({
      dn: smaller.dn,
      pressureClass,
      bodyStyle,
      trimStyle,
      flowDirection,
      reducedTrimFactor,
      useExtendedStroke,
    });
    return {
      ratedCv: corr.ratedCv,
      label: `DN${smaller.dn} (${smaller.npsLabel})`,
    };
  }, [
    selectedDN,
    pressureClass,
    bodyStyle,
    trimStyle,
    flowDirection,
    reducedTrimFactor,
    useExtendedStroke,
  ]);

  const governingOperatingPressures = useMemo(() => {
    const active = effectiveOperatingCases.filter((c) => c.enabled);
    if (active.length === 0) {
      return { P1: 31.0, P2: 19.5, Pv: 1.0 };
    }
    const maxDpCase = active.reduce((prev, curr) =>
      curr.P1_bar_a - curr.P2_bar_a > prev.P1_bar_a - prev.P2_bar_a ? curr : prev
    );
    return {
      P1: maxDpCase.P1_bar_a,
      P2: maxDpCase.P2_bar_a,
      Pv: maxDpCase.Pv_bar_a,
    };
  }, [effectiveOperatingCases]);

  const effectiveStages =
    methodologyMode === 'ADVANCED_LOCAL_3D'
      ? Math.max(TRIM_STYLES[trimStyle].stages, numConcentricStages)
      : TRIM_STYLES[trimStyle].stages;

  // Evaluate preliminary required Cv across active operating cases to size cage and check area saturation
  const maxProcessRequiredCv = useMemo(() => {
    const activeCases = effectiveOperatingCases.filter((c) => c.enabled);
    if (activeCases.length === 0) return 0;
    const reqCvs = activeCases.map((point) => {
      const res = evaluateOperatingCase({
        point,
        piping,
        valveD_mm: correlatedValve.d_mm,
        seatPort_mm: correlatedValve.d_port_mm,
        ratedCv: correlatedValve.ratedCv,
        FL: correlatedValve.FL,
        Kc: correlatedValve.Kc,
        xT: correlatedValve.xT,
        Fd: correlatedValve.Fd,
        stages: effectiveStages,
        drilledHoleDia_mm: baseHoleDia_mm,
        characteristicType: effectiveCharConfig.type,
        equalPctRangeability: effectiveCharConfig.equalPctRangeability,
        stroke_mm: correlatedValve.stroke_mm,
        flowDirection,
        cageMaterialId: cageMaterial,
        methodologyMode,
        compensateGalleryAsymmetry,
      });
      return res.requiredCv || 0;
    });
    return Math.max(...reqCvs, 0);
  }, [
    effectiveOperatingCases,
    piping,
    correlatedValve,
    effectiveStages,
    baseHoleDia_mm,
    effectiveCharConfig,
    flowDirection,
    cageMaterial,
    methodologyMode,
    compensateGalleryAsymmetry,
  ]);

  const cageSynthesis = useMemo(
    () =>
      synthesizeDrilledCageAndStress({
        cageID_mm: correlatedValve.d_port_mm,
        stroke_mm: correlatedValve.stroke_mm,
        targetTrimCv: correlatedValve.cvTrimComponent,
        cvSeatComponent: correlatedValve.cvSeatComponent,
        cvBodyComponent: correlatedValve.cvBodyComponent,
        orificeDischargeCoeff: TRIM_STYLES[trimStyle].orificeDischargeCoeff,
        characteristicConfig: effectiveCharConfig,
        numRows,
        baseHoleDia_mm,
        modulateHoleDiameter,
        enforceZeroDeadbandOverlap,
        targetRowOverlapPct,
        holeSpacingRule,
        selectedWallThickness_mm,
        erosionAllowance_mm,
        shutoffDeltaP_bar: effectiveShutoffDeltaP_bar,
        operatingTemp_degC: maxOperatingTemp_degC,
        materialId: cageMaterial,
        requireNaceSourService,
        ratedValveCv: correlatedValve.ratedCv,
        maxProcessRequiredCv,
        numConcentricStages,
        compensateGalleryAsymmetry,
        methodologyMode,
        flowDirection,
        manufacturingProcess,
        upstreamP1_bar_a: governingOperatingPressures.P1,
        downstreamP2_bar_a: governingOperatingPressures.P2,
        vaporPressurePv_bar_a: governingOperatingPressures.Pv,
        nextSmallerSizeRatedCv: nextSmallerValveInfo.ratedCv,
        nextSmallerSizeLabel: nextSmallerValveInfo.label,
      }),
    [
      correlatedValve,
      trimStyle,
      effectiveCharConfig,
      numRows,
      baseHoleDia_mm,
      modulateHoleDiameter,
      enforceZeroDeadbandOverlap,
      targetRowOverlapPct,
      holeSpacingRule,
      selectedWallThickness_mm,
      erosionAllowance_mm,
      effectiveShutoffDeltaP_bar,
      maxOperatingTemp_degC,
      cageMaterial,
      requireNaceSourService,
      maxProcessRequiredCv,
      numConcentricStages,
      compensateGalleryAsymmetry,
      methodologyMode,
      flowDirection,
      manufacturingProcess,
      governingOperatingPressures,
      nextSmallerValveInfo,
    ]
  );

  const caseResults = useMemo(
    () =>
      effectiveOperatingCases
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
            stages: effectiveStages,
            drilledHoleDia_mm: cageSynthesis.meanHoleDia_mm,
            characteristicType: effectiveCharConfig.type,
            equalPctRangeability: effectiveCharConfig.equalPctRangeability,
            stroke_mm: correlatedValve.stroke_mm,
            flowDirection,
            cageMaterialId: cageMaterial,
            methodologyMode,
            compensateGalleryAsymmetry,
          })
        ),
    [
      effectiveOperatingCases,
      piping,
      correlatedValve,
      cageSynthesis,
      effectiveStages,
      effectiveCharConfig,
      flowDirection,
      cageMaterial,
      methodologyMode,
      compensateGalleryAsymmetry,
    ]
  );

  // Automated Valve Size & Pressure Rating Recommender based on active process conditions (60–90% Max Cv Rule)
  const valveRecommendation = useMemo(
    () =>
      recommendValveSizeAndRating({
        cases: effectiveOperatingCases,
        piping,
        trimStyle,
        bodyStyle,
        flowDirection,
        reducedTrimFactor,
        useExtendedStroke,
        characteristicType: effectiveCharConfig.type,
        equalPctRangeability: effectiveCharConfig.equalPctRangeability,
        bodyMaterial,
      }),
    [
      effectiveOperatingCases,
      piping,
      trimStyle,
      bodyStyle,
      flowDirection,
      reducedTrimFactor,
      useExtendedStroke,
      effectiveCharConfig.type,
      effectiveCharConfig.equalPctRangeability,
      bodyMaterial,
    ]
  );

  const charSimulation = useMemo(() => {
    const activeCvs = caseResults.map((r) => r.requiredCv).filter((v) => v > 0);
    return simulateCharacteristicCurves({
      config: effectiveCharConfig,
      ratedCv: correlatedValve.ratedCv,
      stroke_mm: correlatedValve.stroke_mm,
      maxSystemDeltaP_bar: effectiveShutoffDeltaP_bar,
      maxOperatingRequiredCv: activeCvs.length > 0 ? Math.max(...activeCvs) : undefined,
      minOperatingRequiredCv: activeCvs.length > 0 ? Math.min(...activeCvs) : undefined,
    });
  }, [effectiveCharConfig, correlatedValve, effectiveShutoffDeltaP_bar, caseResults]);

  const cageHasHardFacing = cageMaterial === 'SS316TI_CR_HF' || cageMaterial === 'STELLITE_6';

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
        finalProcessTemp_degC: effectiveThermalTargetTemp_degC,
        rampRate_degC_per_min,
        convectiveHeatTransferCoeff_W_m2K: convectiveH_W_m2K,
        requireLethalBellowsSeal,
        cageHasHardFacing,
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
      effectiveThermalTargetTemp_degC,
      rampRate_degC_per_min,
      convectiveH_W_m2K,
      requireLethalBellowsSeal,
      cageHasHardFacing,
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
        shutoffDeltaP_bar: effectiveShutoffDeltaP_bar,
        downstreamShutoffP2_bar_g: Math.max(
          0,
          Number((maxUpstreamP1_bar_a - 1.013 - effectiveShutoffDeltaP_bar).toFixed(2))
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
      effectiveShutoffDeltaP_bar,
      maxUpstreamP1_bar_a,
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

  // Industry Standards & Specifications Evaluations (ASME B16.34, NACE MR0175, ISO 15848, ISA-75.08, SIL/ISA-75.25)
  const minOperatingTemp_degC = useMemo(
    () => Math.min(...effectiveOperatingCases.filter((c) => c.enabled).map((c) => c.T1_degC), 20),
    [effectiveOperatingCases]
  );

  const asmeB1634Result = useMemo(
    () =>
      evaluateAsmeB1634Rating(
        pressureClass,
        bodyMaterial,
        maxUpstreamP1_bar_a,
        maxOperatingTemp_degC
      ),
    [pressureClass, bodyMaterial, maxUpstreamP1_bar_a, maxOperatingTemp_degC]
  );

  const naceScreeningResult = useMemo(
    () =>
      evaluateNaceScreening({
        sourServiceEnabled: requireNaceSourService,
        h2sPartialPressure_bar,
        chloride_ppm,
        operatingTemp_degC: maxOperatingTemp_degC,
        cageMaterialId: cageMaterial,
        stemMaterialId: stemMaterial,
      }),
    [
      requireNaceSourService,
      h2sPartialPressure_bar,
      chloride_ppm,
      maxOperatingTemp_degC,
      cageMaterial,
      stemMaterial,
    ]
  );

  const fugitiveEmissionsSpec = useMemo(
    () =>
      evaluateFugitiveEmissions(
        packingType,
        requireLethalBellowsSeal,
        maxOperatingTemp_degC
      ),
    [packingType, requireLethalBellowsSeal, maxOperatingTemp_degC]
  );

  const pipingBodyStandards = useMemo(
    () =>
      evaluatePipingAndBodyStandards({
        dn: selectedDN,
        classId: pressureClass,
        endConnection,
        fireSafeRequired,
        packingType,
        shutoffClass,
        minTemp_degC: minOperatingTemp_degC,
      }),
    [
      selectedDN,
      pressureClass,
      endConnection,
      fireSafeRequired,
      packingType,
      shutoffClass,
      minOperatingTemp_degC,
    ]
  );

  const silPositionerResult = useMemo(
    () =>
      evaluateSilAndPositioner({
        silServiceEnabled,
        targetSilLevel,
        stroke_mm: correlatedValve.stroke_mm,
        actuatorEffectiveArea_cm2: actuatorArea_cm2,
        airSupplyPressure_bar_g: airSupply_bar_g,
        packingFrictionForceC_N: actuatorStemResult.balanced.packingFrictionForceC_N,
        benchSetSpan_bar: Math.max(0.2, benchSetUpper_bar_g - benchSetLower_bar_g),
      }),
    [
      silServiceEnabled,
      targetSilLevel,
      correlatedValve.stroke_mm,
      actuatorArea_cm2,
      airSupply_bar_g,
      actuatorStemResult.balanced.packingFrictionForceC_N,
      benchSetUpper_bar_g,
      benchSetLower_bar_g,
    ]
  );

  // Per-tab engineering validation statuses for tab badge indicators
  const tabStatuses = useMemo<Record<ActiveTabId, 'PASS' | 'WARNING' | 'CRITICAL'>>(() => {
    const processCritical = caseResults.some(
      (r) =>
        r.regimeSeverity === 'CRITICAL' ||
        r.noiseStatus === 'CRITICAL' ||
        r.bodyVelocity_m_s > r.bodyVelocityLimit_m_s ||
        r.outletMach > r.outletMachLimit ||
        r.percentOfRatedCv > 100
    );
    const processWarning =
      caseResults.some(
        (r) =>
          r.regimeSeverity === 'WARNING' ||
          r.noiseStatus === 'WARNING' ||
          r.percentOfRatedCv > 85 ||
          r.percentOfRatedCv < 10 ||
          r.localCavitationRiskWarning ||
          r.ftoWallImpingementWarning
      ) || Boolean(backpressureOrificeResult?.caseShares.some((s) => s.orificeChokedWarning));
    const PROCESS_SIZING = processCritical ? 'CRITICAL' : processWarning ? 'WARNING' : 'PASS';

    const CHARACTERISTICS =
      charSimulation.nelesSafetyFactorTrapWarning || charSimulation.stabilityBandCoveragePct < 55
        ? 'CRITICAL'
        : charSimulation.stabilityBandCoveragePct < 80
        ? 'WARNING'
        : 'PASS';

    const cageCritical =
      cageSynthesis.structuralStatus === 'CRITICAL' ||
      cageSynthesis.saturationSeverity === 'SATURATED_UPSIZE_RECOMMENDED' ||
      cageSynthesis.drillManufacturabilityStatus === 'CRITICAL' ||
      !cageSynthesis.naceSourCompliant ||
      !cageSynthesis.tempCompliant;
    const cageWarning =
      cageSynthesis.structuralStatus === 'WARNING' ||
      cageSynthesis.saturationSeverity !== 'OPTIMAL' ||
      cageSynthesis.drillManufacturabilityStatus === 'WARNING' ||
      !cageSynthesis.jetCoalescenceCompliant;
    const CAGE_CAD_STRESS = cageCritical ? 'CRITICAL' : cageWarning ? 'WARNING' : 'PASS';

    const thermalCritical =
      thermalResult.radialBindingRisk === 'CRITICAL' ||
      thermalResult.axialCrushRisk === 'CRITICAL' ||
      thermalResult.gallingRisk === 'CRITICAL';
    const thermalWarning =
      thermalResult.radialBindingRisk === 'WARNING' ||
      thermalResult.axialCrushRisk === 'WARNING' ||
      thermalResult.gallingRisk === 'WARNING';
    const TRANSIENT_THERMAL = thermalCritical ? 'CRITICAL' : thermalWarning ? 'WARNING' : 'PASS';

    const activeSeatingMargin =
      actuatorStemResult.activeMode === 'BALANCED'
        ? actuatorStemResult.actuatorMarginBalancedPct
        : actuatorStemResult.actuatorMarginUnbalancedPct;
    const activeOpenMargin =
      actuatorStemResult.activeMode === 'BALANCED'
        ? actuatorStemResult.openStrokeMarginBalancedPct
        : actuatorStemResult.openStrokeMarginUnbalancedPct;
    const actuatorCritical =
      actuatorStemResult.stemStructuralStatus === 'CRITICAL' ||
      actuatorStemResult.sealShutoffCompatibilityStatus === 'CRITICAL' ||
      activeSeatingMargin < 0 ||
      activeOpenMargin < 0;
    const actuatorWarning =
      actuatorStemResult.stemStructuralStatus === 'WARNING' ||
      actuatorStemResult.sealShutoffCompatibilityStatus === 'WARNING' ||
      activeSeatingMargin < 10 ||
      activeOpenMargin < 10;
    const ACTUATOR_STEM = actuatorCritical ? 'CRITICAL' : actuatorWarning ? 'WARNING' : 'PASS';

    return {
      PROCESS_SIZING,
      CHARACTERISTICS,
      CAGE_CAD_STRESS,
      TRANSIENT_THERMAL,
      ACTUATOR_STEM,
      MASTER_SCHEDULE: 'PASS',
    };
  }, [
    caseResults,
    backpressureOrificeResult,
    charSimulation,
    cageSynthesis,
    thermalResult,
    actuatorStemResult,
  ]);

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
      const minLineId_mm = Number((spec.d_mm * 1.25).toFixed(1));
      const matchedSchedule =
        ASME_PIPE_SCHEDULES.find(
          (p) => p.dn >= dn && p.pipeID_mm >= spec.d_mm && p.id.endsWith('_SCH40')
        ) ||
        ASME_PIPE_SCHEDULES.find((p) => p.dn >= dn && p.pipeID_mm >= spec.d_mm);
      setPiping((prev) => ({
        ...prev,
        upstreamPipeID_mm:
          prev.upstreamPipeID_mm >= spec.d_mm
            ? prev.upstreamPipeID_mm
            : matchedSchedule
            ? matchedSchedule.pipeID_mm
            : minLineId_mm,
        downstreamPipeID_mm:
          prev.downstreamPipeID_mm >= spec.d_mm
            ? prev.downstreamPipeID_mm
            : matchedSchedule
            ? matchedSchedule.pipeID_mm
            : minLineId_mm,
        pipeWallThickness_mm:
          prev.upstreamPipeID_mm >= spec.d_mm
            ? prev.pipeWallThickness_mm
            : matchedSchedule
            ? matchedSchedule.wall_mm
            : prev.pipeWallThickness_mm,
      }));
      if (
        matchedSchedule &&
        (piping.upstreamPipeID_mm < spec.d_mm || piping.downstreamPipeID_mm < spec.d_mm)
      ) {
        setPipeScheduleId(matchedSchedule.id);
      }
    }
  };

  const handlePipeScheduleChange = (schedId: string) => {
    setPipeScheduleId(schedId);
    const sched = ASME_PIPE_SCHEDULES.find((s) => s.id === schedId);
    if (sched) {
      setPiping((prev) => ({
        ...prev,
        upstreamPipeID_mm: sched.pipeID_mm,
        downstreamPipeID_mm: sched.pipeID_mm,
        pipeWallThickness_mm: sched.wall_mm,
      }));
    }
  };

  const handleCageMaterialChange = (matId: CageMaterialId) => {
    setCageMaterial(matId);
    const alloyMap: Record<CageMaterialId, ThermalAlloyId> = {
      SS316TI_CR_HF: 'CF8M_316SS',
      SS316L: 'CF8M_316SS',
      SS410_HT: 'SS410_MARTENSITIC',
      CA6NM_13CR4NI: 'SS410_MARTENSITIC',
      PH17_4_H900: 'PH17_4',
      PH17_4_H1150M: 'PH17_4',
      HASTELLOY_C276: 'HASTELLOY_C276',
      INCONEL_718: 'INCONEL_718',
      STELLITE_6: 'INCONEL_718',
    };
    setCageAlloy(alloyMap[matId]);
  };

  const handleBodyMaterialCategoryChange = (cat: 'CARBON_STEEL' | 'STAINLESS_ALLOY') => {
    setPiping((prev) => ({ ...prev, bodyMaterialCategory: cat }));
    if (cat === 'CARBON_STEEL') {
      setBodyAlloy('WCB_CARBON_STEEL');
    } else if (bodyAlloy === 'WCB_CARBON_STEEL') {
      setBodyAlloy('WC9_CR_MO');
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
      projectMeta,
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
        pipeScheduleId,
        autoSyncPv,
        syncThermalTempWithProcess,
        customShutoffDeltaP_bar,
        piping,
        operatingCases,
        charConfig,
        methodologyMode,
        manufacturingProcess,
        numConcentricStages,
        compensateGalleryAsymmetry,
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
        if (data.projectMeta) {
          setProjectMeta((prev) => ({ ...prev, ...data.projectMeta }));
        }

        const inp = data.inputs || data;
        if (inp.projectMeta) {
          setProjectMeta((prev) => ({ ...prev, ...inp.projectMeta }));
        }
        if (inp.pipeScheduleId !== undefined) setPipeScheduleId(inp.pipeScheduleId);
        if (inp.autoSyncPv !== undefined) setAutoSyncPv(inp.autoSyncPv);
        if (inp.syncThermalTempWithProcess !== undefined) {
          setSyncThermalTempWithProcess(inp.syncThermalTempWithProcess);
        }
        if (inp.customShutoffDeltaP_bar !== undefined) {
          setCustomShutoffDeltaP_bar(inp.customShutoffDeltaP_bar);
        }
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
        if (inp.methodologyMode !== undefined) setMethodologyMode(inp.methodologyMode);
        if (inp.manufacturingProcess !== undefined) setManufacturingProcess(inp.manufacturingProcess);
        if (inp.numConcentricStages !== undefined) setNumConcentricStages(inp.numConcentricStages);
        if (inp.compensateGalleryAsymmetry !== undefined) setCompensateGalleryAsymmetry(inp.compensateGalleryAsymmetry);
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
      <a
        href="#main-content"
        className="visually-hidden fixed top-2 left-2 z-[100] bg-[#0f8b8d] text-white px-3 py-1.5 rounded-md text-xs font-mono font-semibold shadow-lg no-print"
      >
        Skip to main content
      </a>
      {/* DY-MIMIC DEEP NAVY MASTHEAD WITH 4PX SAFETY AMBER BOTTOM BORDER */}
      <header className="sticky top-0 z-50 bg-[#0b2545] border-b-4 border-[#f2a900] px-6 py-3.5 shadow-md no-print">
        <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#13315c] border border-[#f2a900]/60 flex items-center justify-center text-[#ffd77a] shadow-sm">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-base font-bold tracking-tight text-white">
                  DY-SIZE // CONTROL VALVE & DRILLED CAGE CAE SUITE
                </h1>
                <span className="px-2 py-0.5 rounded bg-[#0f8b8d] text-white border border-[#7fe0e2]/50 font-mono text-[11px] font-bold tracking-wide shadow-sm">
                  Rev {APP_VERSION}
                </span>
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
                aria-haspopup="menu"
                aria-controls="tools-dropdown-menu"
              >
                <Wrench className="w-3.5 h-3.5 text-[#ffd77a]" aria-hidden="true" />
                Tools
                <ChevronDown
                  aria-hidden="true"
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    isToolsMenuOpen ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {isToolsMenuOpen && (
                <div
                  id="tools-dropdown-menu"
                  role="menu"
                  aria-label="Engineering Tools and Exports"
                  className="absolute right-0 mt-2 w-64 rounded-xl bg-[#0f1419] border border-[#2f3b47] shadow-2xl py-2 z-50 text-xs font-mono divide-y divide-[#2f3b47]/60"
                >
                  {/* File Save / Load group */}
                  <div className="py-1" role="group" aria-label="Project Files">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        handleSaveDYSol();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#182028] text-slate-200 hover:text-[#7fe0e2] flex items-center gap-2.5 transition"
                    >
                      <Save className="w-4 h-4 text-[#7fe0e2]" aria-hidden="true" />
                      <div>
                        <div className="font-semibold text-white">Save .DYSol File</div>
                        <div className="text-[10px] text-slate-400">Save complete inputs & outputs</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        handleLoadDYSolClick();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#182028] text-slate-200 hover:text-[#8be0a8] flex items-center gap-2.5 transition"
                    >
                      <Upload className="w-4 h-4 text-[#8be0a8]" aria-hidden="true" />
                      <div>
                        <div className="font-semibold text-white">Load .DYSol File</div>
                        <div className="text-[10px] text-slate-400">Restore sizing & valve state</div>
                      </div>
                    </button>
                  </div>

                  {/* CAD, CNC & Schedule Exports */}
                  <div className="py-1" role="group" aria-label="CAD and CNC Exports">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        handleExportDXF();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#182028] text-slate-200 hover:text-white flex items-center gap-2.5 transition"
                    >
                      <Download className="w-4 h-4 text-[#7fe0e2]" aria-hidden="true" />
                      <div>
                        <div className="font-semibold text-white">.DXF CAD</div>
                        <div className="text-[10px] text-slate-400">2D unrolled cage perforation</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        handleExportGCode();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#182028] text-slate-200 hover:text-white flex items-center gap-2.5 transition"
                    >
                      <FileCode className="w-4 h-4 text-[#8be0a8]" aria-hidden="true" />
                      <div>
                        <div className="font-semibold text-white">4-AXIS G-CODE</div>
                        <div className="text-[10px] text-slate-400">CNC 4-axis rotary indexer code</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        handleExportCSV();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#182028] text-slate-200 hover:text-white flex items-center gap-2.5 transition"
                    >
                      <Table className="w-4 h-4 text-[#ffd77a]" aria-hidden="true" />
                      <div>
                        <div className="font-semibold text-white">.CSV SCHEDULE</div>
                        <div className="text-[10px] text-slate-400">Drilled cage row perforation matrix</div>
                      </div>
                    </button>
                  </div>

                  {/* Print Datasheet */}
                  <div className="py-1" role="group" aria-label="Reporting">
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsToolsMenuOpen(false);
                        window.print();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-[#182028] text-slate-200 hover:text-[#ffd77a] flex items-center gap-2.5 transition"
                    >
                      <Printer className="w-4 h-4 text-[#ffd77a]" aria-hidden="true" />
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

      {/* GLOBAL PROJECT METADATA, WORKBENCH TABS & HARDWARE CONTROL BAR (BELOW HEADER) */}
      <section className="bg-[#edf1f5] border-b border-[#cfd8e3] px-6 py-3 no-print">
        <div className="max-w-[1600px] mx-auto space-y-2.5">
          {/* Compact Project / Tag Identification Strip (Synced to Print Datasheet & .DYSol) */}
          <div className="bg-white rounded-lg px-3 py-2 border border-[#cfd8e3] shadow-sm grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-12 gap-2.5 items-center">
            <div className="lg:col-span-2 flex items-center gap-2">
              <label htmlFor="meta-tag-number" className="text-[10px] font-mono uppercase tracking-wider text-[#13315c] font-bold shrink-0">
                Tag No.
              </label>
              <input
                id="meta-tag-number"
                type="text"
                value={projectMeta.tagNumber}
                onChange={(e) => setProjectMeta({ ...projectMeta, tagNumber: e.target.value })}
                className="w-full bg-[#f8fafc] border border-[#cfd8e3] rounded px-2 py-1 text-xs font-mono font-bold text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d] focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                placeholder="FV-1001A"
              />
            </div>
            <div className="lg:col-span-5 flex items-center gap-2">
              <label htmlFor="meta-service-desc" className="text-[10px] font-mono uppercase tracking-wider text-[#13315c] font-bold shrink-0">
                Service
              </label>
              <input
                id="meta-service-desc"
                type="text"
                value={projectMeta.serviceDescription}
                onChange={(e) =>
                  setProjectMeta({ ...projectMeta, serviceDescription: e.target.value })
                }
                className="w-full bg-[#f8fafc] border border-[#cfd8e3] rounded px-2 py-1 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d] focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                placeholder="Service Description"
              />
            </div>
            <div className="lg:col-span-3 flex items-center gap-2">
              <label htmlFor="meta-line-number" className="text-[10px] font-mono uppercase tracking-wider text-[#13315c] font-bold shrink-0">
                Line / P&amp;ID
              </label>
              <input
                id="meta-line-number"
                type="text"
                value={projectMeta.lineNumber}
                onChange={(e) => setProjectMeta({ ...projectMeta, lineNumber: e.target.value })}
                className="w-full bg-[#f8fafc] border border-[#cfd8e3] rounded px-2 py-1 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d] focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                placeholder='4"-BFW-104'
              />
            </div>
            <div className="lg:col-span-2 flex items-center gap-2">
              <label htmlFor="meta-project-rev" className="text-[10px] font-mono uppercase tracking-wider text-[#13315c] font-bold shrink-0">
                Rev
              </label>
              <input
                id="meta-project-rev"
                type="text"
                value={projectMeta.projectRev}
                onChange={(e) => setProjectMeta({ ...projectMeta, projectRev: e.target.value })}
                className="w-full bg-[#f8fafc] border border-[#cfd8e3] rounded px-2 py-1 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d] focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                placeholder="Rev A"
              />
            </div>
          </div>

          {/* SEGMENTED WORKBENCH MODE SWITCHER WITH LIVE PASS/WARNING/CRITICAL INDICATORS */}
          <div
            role="tablist"
            aria-label="Engineering Workbench Modules"
            className="flex flex-wrap items-center gap-1.5 bg-white p-1.5 rounded-xl border border-[#cfd8e3] shadow-sm"
          >
            {[
              {
                id: 'PROCESS_SIZING',
                label: '1. Sizing & Noise (IEC 60534)',
                icon: Activity,
              },
              {
                id: 'CHARACTERISTICS',
                label: '2. Characteristic & Gain (Pv)',
                icon: Sliders,
              },
              {
                id: 'CAGE_CAD_STRESS',
                label: '3. Drilled Cage, Stress & CAM',
                icon: Layers,
              },
              {
                id: 'TRANSIENT_THERMAL',
                label: '4. Thermal Binding & Bonnet',
                icon: Thermometer,
              },
              {
                id: 'ACTUATOR_STEM',
                label: '5. Actuator Thrust & Stem',
                icon: Wrench,
              },
              {
                id: 'MASTER_SCHEDULE',
                label: '6. Valve Correlation Table',
                icon: Table,
              },
            ].map((tab, idx, allTabs) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const tabStatus = tabStatuses[tab.id as ActiveTabId];
              const dotColor =
                tabStatus === 'CRITICAL'
                  ? 'bg-red-500 ring-2 ring-red-200'
                  : tabStatus === 'WARNING'
                  ? 'bg-amber-400 ring-2 ring-amber-200'
                  : 'bg-emerald-400';
              return (
                <button
                  key={tab.id}
                  id={`workbench-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => setActiveTab(tab.id as ActiveTabId)}
                  onKeyDown={(e) => {
                    let nextIdx: number | null = null;
                    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % allTabs.length;
                    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + allTabs.length) % allTabs.length;
                    else if (e.key === 'Home') nextIdx = 0;
                    else if (e.key === 'End') nextIdx = allTabs.length - 1;
                    if (nextIdx !== null) {
                      e.preventDefault();
                      const nextTab = allTabs[nextIdx];
                      setActiveTab(nextTab.id as ActiveTabId);
                      document.getElementById(`workbench-tab-${nextTab.id}`)?.focus();
                    }
                  }}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono transition ${
                    isActive
                      ? 'bg-[#0f8b8d] text-white font-semibold shadow-sm'
                      : 'text-[#13315c] hover:text-[#0b2545] hover:bg-[#edf1f5]'
                  }`}
                  title={`Module status: ${tabStatus}`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>{tab.label}</span>
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`}
                    aria-label={`Status ${tabStatus}`}
                  />
                </button>
              );
            })}
          </div>

          {/* MASTER SIZING & CAGE METHODOLOGY SWITCH (CONVENTIONAL 1D VS ADVANCED 3D LOCAL FLOW) */}
          <div className="bg-[#182028] rounded-xl px-4 py-2.5 border border-[#2f3b47] shadow-sm flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[#ffd77a] flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" />
                Sizing &amp; Trim Methodology:
              </span>
              <div className="inline-flex rounded-lg p-0.5 bg-[#0f1419] border border-[#2f3b47]">
                <button
                  type="button"
                  onClick={() => handleMethodologyModeChange('CONVENTIONAL_1D')}
                  className={`px-3 py-1 rounded text-xs font-mono font-semibold transition ${
                    methodologyMode === 'CONVENTIONAL_1D'
                      ? 'bg-[#f2a900] text-[#0b2545] shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Standard lumped 1D IEC 60534 sizing & uniform circular cage rows"
                >
                  Conventional 1D (IEC Uniform)
                </button>
                <button
                  type="button"
                  onClick={() => handleMethodologyModeChange('ADVANCED_LOCAL_3D')}
                  className={`px-3 py-1 rounded text-xs font-mono font-semibold transition ${
                    methodologyMode === 'ADVANCED_LOCAL_3D'
                      ? 'bg-[#0f8b8d] text-white shadow-sm'
                      : 'text-slate-300 hover:text-white'
                  }`}
                  title="Sibanda (2022) 3D gallery crossflow, Singh (2019/2020) roughness & multiphase, Bu (2022) 15-plane, FTO/FTC directional physics"
                >
                  Advanced 3D Local Flow (Sibanda / Singh / Asim)
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-[#0f1419] border border-[#2f3b47] text-[#7fe0e2]">
                Dir:{' '}
                <strong>
                  {flowDirection === 'FTC'
                    ? 'FTC (Outside→In Core Impingement)'
                    : 'FTO (Inside→Out Gallery Expansion)'}
                </strong>
              </span>
              {methodologyMode === 'ADVANCED_LOCAL_3D' ? (
                <>
                  <span className="px-2 py-0.5 rounded bg-[#0f1419] border border-[#2f3b47] text-[#8be0a8]">
                    3D Trim Gain: <strong>+{cageSynthesis.advancedCapacityGainPct}% Cv</strong>
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded bg-[#0f1419] border border-[#2f3b47] ${
                      cageSynthesis.canDownsizeValveBody ? 'text-[#8be0a8]' : 'text-slate-300'
                    }`}
                    title={cageSynthesis.downsizeCandidateLabel}
                  >
                    {cageSynthesis.canDownsizeValveBody
                      ? `Downsize Ready (${nextSmallerValveInfo.label || '1 Step'})`
                      : 'Current DN Required'}
                  </span>
                </>
              ) : (
                <span className="px-2 py-0.5 rounded bg-[#0f1419] border border-[#2f3b47] text-slate-400">
                  Uniform Cd • No Local Flank / Roughness Corrections
                </span>
              )}
            </div>
          </div>

          {/* GLOBAL VALVE HARDWARE SELECTORS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {/* Nominal Valve Size */}
            <div className="bg-white rounded-lg p-2.5 border border-[#cfd8e3] shadow-sm">
              <label htmlFor="hw-nominal-size" className="block text-[10px] font-mono uppercase tracking-wider text-[#13315c] font-semibold mb-1">
                Nominal Valve Size (DN / NPS)
              </label>
              <select
                id="hw-nominal-size"
                value={selectedDN}
                onChange={(e) => handleSelectSizeFromSchedule(Number(e.target.value))}
                className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d] focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
              <label htmlFor="hw-pressure-class" className="block text-[10px] font-mono uppercase tracking-wider text-[#13315c] font-semibold mb-1">
                Pressure Class (ASME / PN)
              </label>
              <select
                id="hw-pressure-class"
                value={pressureClass}
                onChange={(e) => setPressureClass(e.target.value as PressureClassId)}
                className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d] focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
              <label htmlFor="hw-trim-style" className="block text-[10px] font-mono uppercase tracking-wider text-[#13315c] font-semibold mb-1">
                Generic Trim Style & Stages
              </label>
              <select
                id="hw-trim-style"
                value={trimStyle}
                onChange={(e) => setTrimStyle(e.target.value as TrimStyleId)}
                className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d] focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
              <label htmlFor="hw-reduced-trim" className="block text-[10px] font-mono uppercase tracking-wider text-[#13315c] font-semibold mb-1">
                Trim Capacity Factor (R5 Series)
              </label>
              <select
                id="hw-reduced-trim"
                value={reducedTrimFactor}
                onChange={(e) => {
                  setReducedTrimFactor(Number(e.target.value));
                  setCustomBoreOverride(null);
                  setCustomRatedCvOverride(null);
                }}
                className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d] focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
              <label htmlFor="hw-body-style" className="block text-[10px] font-mono uppercase tracking-wider text-[#13315c] font-semibold mb-1">
                Body Style & Flow Direction
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <select
                  id="hw-body-style"
                  aria-label="Body Style"
                  value={bodyStyle}
                  onChange={(e) => setBodyStyle(e.target.value as BodyStyleId)}
                  className="bg-white border border-[#cfd8e3] rounded px-2 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d] focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                >
                  <option value="GLOBE_STRAIGHT">Globe (1.0x)</option>
                  <option value="ANGLE_BODY">Angle (1.12x)</option>
                </select>
                <select
                  id="hw-flow-direction"
                  aria-label="Flow Direction"
                  value={flowDirection}
                  onChange={(e) => setFlowDirection(e.target.value as FlowDirectionId)}
                  className="bg-white border border-[#cfd8e3] rounded px-2 py-1.5 text-xs font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d] focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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

          {/* COLLAPSIBLE LIVE CORRELATED HARDWARE KPI READOUT STRIP */}
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setShowHardwareKpis((prev) => !prev)}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono font-semibold text-[#13315c] hover:text-[#0f8b8d] transition"
            >
              {showHardwareKpis ? (
                <ChevronUp className="w-3.5 h-3.5" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5" />
              )}
              <span>
                {showHardwareKpis
                  ? 'Hide Correlated Hardware Telemetry'
                  : 'Show Correlated Hardware Telemetry'}
              </span>
              {!showHardwareKpis && (
                <span className="text-slate-500 font-normal">
                  — {correlatedValve.ratedCv} Cv ({correlatedValve.ratedKv} Kv) • Ø
                  {correlatedValve.d_port_mm}mm • {correlatedValve.stroke_mm}mm •{' '}
                  {cageSynthesis.totalHoles} holes
                </span>
              )}
            </button>
            <span className="hidden sm:inline text-[11px] font-mono text-slate-500">
              {projectMeta.tagNumber} • DN{selectedDN} (
              {GENERIC_VALVE_SCHEDULE.find((s) => s.dn === selectedDN)?.npsLabel}) •{' '}
              {PRESSURE_CLASSES[pressureClass].label.split('/')[0]}
            </span>
          </div>

          {showHardwareKpis && (
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
          )}
        </div>
      </section>

      {/* MAIN WORKBENCH CONTENT AREA */}
      <main id="main-content" tabIndex={-1} className="flex-1 max-w-[1600px] w-full mx-auto px-6 py-6 space-y-6 no-print focus:outline-none">
        {/* =====================================================================
            TAB 1: MULTI-CONDITION PROCESS SIZING, SWAGED PIPING & ACOUSTIC NOISE
           ===================================================================== */}
        {activeTab === 'PROCESS_SIZING' && (
          <div className="space-y-6">
            {/* CARD 1: Fluid Preset Loader & Swaged Piping Envelope */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Fluid Presets & Custom Dimension Overrides */}
              <div className="lg:col-span-5 dy-card overflow-hidden">
                <div className="section-band px-5 py-3.5">
                  <h2 className="text-sm font-bold text-white flex items-center gap-2">
                    <Gauge className="w-4 h-4 text-[#ffd77a]" />
                    1. Process Fluid Benchmark Presets &amp; Hardware Overrides
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
                      className="w-full bg-white border border-[#cfd8e3] rounded-lg px-3 py-2 text-xs font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                      Swaged Piping Geometry (FP, FLP, xTP) &amp; Water-Hammer Envelope
                    </h2>
                    <p className="text-xs text-slate-300 font-mono">
                      Select ASME B36.10M pipe schedule or edit D1/D2; coupled reducer head loss &amp; Joukowsky reflection
                    </p>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded bg-[#182028] border border-[#2f3b47] text-xs font-mono ${
                      piping.upstreamPipeID_mm < correlatedValve.d_mm ||
                      piping.downstreamPipeID_mm < correlatedValve.d_mm
                        ? 'text-[#ffd77a]'
                        : 'text-[#7fe0e2]'
                    }`}
                  >
                    Valve d = {correlatedValve.d_mm} mm vs Pipe D1/D2 = {piping.upstreamPipeID_mm}/
                    {piping.downstreamPipeID_mm} mm
                  </span>
                </div>

                <div className="p-5 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                    <div className="sm:col-span-7">
                      <label className="block text-[11px] font-mono text-slate-600 mb-1">
                        ASME B36.10M Pipe Schedule (Sets D1, D2 &amp; t_p)
                      </label>
                      <select
                        value={pipeScheduleId}
                        onChange={(e) => handlePipeScheduleChange(e.target.value)}
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                      >
                        <option value="CUSTOM">Custom Pipe ID / Wall</option>
                        {ASME_PIPE_SCHEDULES.map((sched) => (
                          <option key={sched.id} value={sched.id}>
                            {sched.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-5">
                      <label className="block text-[11px] font-mono text-slate-600 mb-1">
                        Body Alloy Group (Syncs Tab 4 Body)
                      </label>
                      <select
                        value={piping.bodyMaterialCategory}
                        onChange={(e) =>
                          handleBodyMaterialCategoryChange(
                            e.target.value as 'CARBON_STEEL' | 'STAINLESS_ALLOY'
                          )
                        }
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                      >
                        <option value="STAINLESS_ALLOY">SS / Cr-Mo (≤15 m/s)</option>
                        <option value="CARBON_STEEL">Carbon Steel (≤10.5 m/s)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    <div>
                      <label className="block text-[11px] font-mono text-slate-600 mb-1">
                        Upstream ID D1 (mm)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={piping.upstreamPipeID_mm}
                        onChange={(e) => {
                          setPipeScheduleId('CUSTOM');
                          setPiping({ ...piping, upstreamPipeID_mm: Number(e.target.value) });
                        }}
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-600 mb-1">
                        Downstream D2 (mm)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={piping.downstreamPipeID_mm}
                        onChange={(e) => {
                          setPipeScheduleId('CUSTOM');
                          setPiping({ ...piping, downstreamPipeID_mm: Number(e.target.value) });
                        }}
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-mono text-slate-600 mb-1">
                        Pipe Wall t_p (mm)
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={piping.pipeWallThickness_mm}
                        onChange={(e) => {
                          setPipeScheduleId('CUSTOM');
                          setPiping({ ...piping, pipeWallThickness_mm: Number(e.target.value) });
                        }}
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                      />
                    </div>
                  </div>
                </div>

                {/* Industry Standards Strip: ASME B16.34 P-T, ISA-75.08.01 Face-to-Face, NACE MR0175, Fire-Safe */}
                <div className="pt-4 border-t border-[#e2e8f0] grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
                  <div className="lg:col-span-3">
                    <label className="block text-[11px] font-mono text-slate-600 mb-1">
                      Body Material (ASME B16.34 Group)
                    </label>
                    <select
                      value={bodyMaterial}
                      onChange={(e) => setBodyMaterial(e.target.value as BodyMaterialGroupId)}
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                    >
                      {Object.values(BODY_MATERIAL_GROUPS).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} ({m.asmeGroup})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-mono text-slate-600 mb-1">
                      End Connection (ISA-75.08)
                    </label>
                    <select
                      value={endConnection}
                      onChange={(e) => setEndConnection(e.target.value as EndConnectionId)}
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                    >
                      <option value="RF_FLANGED">ASME B16.5 RF</option>
                      <option value="RTJ_FLANGED">ASME B16.5 RTJ</option>
                      <option value="BUTT_WELD">ASME B16.25 BW</option>
                    </select>
                  </div>
                  <div className="lg:col-span-2">
                    <label className="block text-[11px] font-mono text-slate-600 mb-1">
                      H₂S Partial P (bar) / Cl⁻ (ppm)
                    </label>
                    <div className="flex gap-1.5">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={h2sPartialPressure_bar}
                        onChange={(e) => setH2sPartialPressure_bar(Number(e.target.value))}
                        className="w-1/2 bg-white border border-[#cfd8e3] rounded px-2 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                        title="H2S partial pressure (bar)"
                      />
                      <input
                        type="number"
                        step="50"
                        min="0"
                        value={chloride_ppm}
                        onChange={(e) => setChloride_ppm(Number(e.target.value))}
                        className="w-1/2 bg-white border border-[#cfd8e3] rounded px-2 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                        title="Chloride concentration (ppm)"
                      />
                    </div>
                  </div>
                  <div className="lg:col-span-5 flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 text-xs font-mono text-[#0b2545] cursor-pointer bg-[#f8fafc] border border-[#cfd8e3] rounded px-2.5 py-1.5">
                      <input
                        type="checkbox"
                        checked={fireSafeRequired}
                        onChange={(e) => setFireSafeRequired(e.target.checked)}
                        className="accent-[#0f8b8d]"
                      />
                      Fire-Safe (API 607)
                    </label>
                    <div
                      className={`px-2.5 py-1.5 rounded border text-[11px] font-mono ${
                        asmeB1634Result.isCompliant
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-red-50 border-red-200 text-red-700 font-bold'
                      }`}
                      title={asmeB1634Result.note}
                    >
                      B16.34: {asmeB1634Result.designPressureBarG} / {asmeB1634Result.maxAllowableBarG} bar g ({asmeB1634Result.utilizationPct}%)
                    </div>
                    <div className="px-2.5 py-1.5 rounded border border-[#cfd8e3] bg-[#f8fafc] text-[11px] font-mono text-[#13315c]">
                      F2F: {pipingBodyStandards.faceToFace_mm} mm • Run: {pipingBodyStandards.minUpstreamStraightRun_mm}/{pipingBodyStandards.minDownstreamStraightRun_mm} mm
                    </div>
                    {!pipingBodyStandards.fireSafeCompliant && (
                      <div className="px-2.5 py-1.5 rounded border border-red-200 bg-red-50 text-[11px] font-mono text-red-700 font-semibold">
                        API 607: Switch to Graphite Packing
                      </div>
                    )}
                    {pipingBodyStandards.cryogenicExtendedBonnetRequired && (
                      <div className="px-2.5 py-1.5 rounded border border-amber-200 bg-amber-50 text-[11px] font-mono text-amber-800 font-semibold">
                        BS 6364 Cryogenic Bonnet Req.
                      </div>
                    )}
                    {naceScreeningResult.warnings.length > 0 && (
                      <div className="px-2.5 py-1.5 rounded border border-amber-200 bg-amber-50 text-[11px] font-mono text-amber-800">
                        NACE: {naceScreeningResult.warnings[0]}
                      </div>
                    )}
                  </div>
                </div>

                {/* Steam Turbine Bypass / PRDS Options (Desuperheater & Downstream Diffuser) */}
                {operatingCases.some((c) => c.enabled && c.fluidPhase === 'STEAM') && (
                  <div className="pt-4 border-t border-[#e2e8f0] grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="bg-[#f8fafc] border border-[#cfd8e3] rounded-lg p-3 space-y-2.5">
                      <label className="flex items-center justify-between text-xs font-mono font-semibold text-[#0b2545] cursor-pointer">
                        <span>PRDS Desuperheater / Spray-Water Attemperation</span>
                        <input
                          type="checkbox"
                          checked={Boolean(piping.desuperheaterEnabled)}
                          onChange={(e) =>
                            setPiping({ ...piping, desuperheaterEnabled: e.target.checked })
                          }
                          className="accent-[#0f8b8d]"
                        />
                      </label>
                      {piping.desuperheaterEnabled && (
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[10px] font-mono text-slate-600 mb-0.5">
                              Spray Temp (°C)
                            </label>
                            <input
                              type="number"
                              step="5"
                              value={piping.sprayWaterTemp_degC ?? 105}
                              onChange={(e) =>
                                setPiping({ ...piping, sprayWaterTemp_degC: Number(e.target.value) })
                              }
                              className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-xs font-mono text-[#0b2545]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-slate-600 mb-0.5">
                              Spray Press (bar a)
                            </label>
                            <input
                              type="number"
                              step="1"
                              value={piping.sprayWaterPressure_bar_a ?? 60}
                              onChange={(e) =>
                                setPiping({
                                  ...piping,
                                  sprayWaterPressure_bar_a: Number(e.target.value),
                                })
                              }
                              className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-xs font-mono text-[#0b2545]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-slate-600 mb-0.5">
                              Target Out (°C)
                            </label>
                            <input
                              type="number"
                              step="5"
                              value={piping.targetDownstreamTemp_degC ?? 240}
                              onChange={(e) =>
                                setPiping({
                                  ...piping,
                                  targetDownstreamTemp_degC: Number(e.target.value),
                                })
                              }
                              className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-xs font-mono text-[#0b2545]"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-[#f8fafc] border border-[#cfd8e3] rounded-lg p-3 space-y-2.5">
                      <label className="flex items-center justify-between text-xs font-mono font-semibold text-[#0b2545] cursor-pointer">
                        <span>Downstream Diffuser / Condenser Sparger Split</span>
                        <input
                          type="checkbox"
                          checked={Boolean(piping.downstreamDiffuserEnabled)}
                          onChange={(e) =>
                            setPiping({ ...piping, downstreamDiffuserEnabled: e.target.checked })
                          }
                          className="accent-[#0f8b8d]"
                        />
                      </label>
                      {piping.downstreamDiffuserEnabled && (
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-[10px] font-mono text-slate-600 mb-0.5">
                              Diffuser Rated Cv
                            </label>
                            <input
                              type="number"
                              step="10"
                              min="1"
                              value={piping.diffuserCv ?? 450}
                              onChange={(e) =>
                                setPiping({ ...piping, diffuserCv: Number(e.target.value) })
                              }
                              className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-xs font-mono text-[#0b2545]"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] font-mono text-slate-600 mb-0.5">
                              Diffuser Choked xT
                            </label>
                            <input
                              type="number"
                              step="0.05"
                              min="0.15"
                              max="0.9"
                              value={piping.diffuserXt ?? 0.65}
                              onChange={(e) =>
                                setPiping({ ...piping, diffuserXt: Number(e.target.value) })
                              }
                              className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-xs font-mono text-[#0b2545]"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* CARD 2: Multi-Condition Operating Inputs Table */}
            <div className="dy-card overflow-hidden dy-defer-section">
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
                    className="bg-[#0f1419] border border-[#2f3b47] text-slate-200 rounded px-2.5 py-1 text-xs focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                      <InfoTooltip label={label} text={infoText} placement={placement} align={align} />
                    </div>
                  );

                  return (
                    <table className="w-full text-left border-separate border-spacing-0 text-xs font-mono">
                      <caption className="visually-hidden">
                        Multi-Condition Process Operating Cases and IEC 60534 Sizing Inputs
                      </caption>
                      <thead>
                        <tr className="border-b border-[#cfd8e3] text-[#13315c] bg-[#edf1f5]">
                          <th scope="col" className="py-2.5 px-3 sticky left-0 z-20 hover:z-30 focus-within:z-30 bg-[#edf1f5] min-w-[230px] border-r border-b border-[#cfd8e3]">
                            {renderParamLabel(
                              'Parameter / Operating Case',
                              'Each column represents a process operating condition (e.g. Min, Normal, Max, Start-Up, Upset). Edit the case name or remove extra cases.'
                            )}
                          </th>
                          {operatingCases.map((c, idx) => (
                            <th key={c.id} scope="col" className="py-2 px-2.5 min-w-[145px] border-b border-[#cfd8e3]">
                              <div className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={c.label}
                                  onChange={(e) => {
                                    const next = [...operatingCases];
                                    next[idx].label = e.target.value;
                                    setOperatingCases(next);
                                  }}
                                  className="bg-white border border-[#cfd8e3] rounded px-2 py-1 w-full text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                                className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                                  className="bg-[#edf1f5] border border-[#cfd8e3] text-[#0f8b8d] font-bold rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                                <InfoTooltip
                                  label="Flow Rate"
                                  text="Process flow rate: volumetric flow in m³/h or gpm for Liquid, standard volumetric flow in Nm³/h or SCFH/SCFM for Gas, or mass flow in kg/h or lb/h for Steam. Automatically converted when switching units."
                                  align="right"
                                />
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
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                                  className="bg-[#edf1f5] border border-[#cfd8e3] text-[#0f8b8d] font-bold rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                                  title="Change P1 display unit with auto-conversion"
                                >
                                  <option value="bar_a">bar a</option>
                                  <option value="psia">psia</option>
                                  <option value="kPa_a">kPa a</option>
                                  <option value="bar_g">bar g</option>
                                  <option value="psig">psig</option>
                                </select>
                                <InfoTooltip
                                  label="P1 Inlet Pressure"
                                  text="Upstream absolute inlet pressure at the valve inlet flange. Used to compute ΔP, choked pressure drop, and gas expansion factor Y."
                                  align="right"
                                />
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
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                                  className="bg-[#edf1f5] border border-[#cfd8e3] text-[#0f8b8d] font-bold rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                                  title="Change P2 display unit with auto-conversion"
                                >
                                  <option value="bar_a">bar a</option>
                                  <option value="psia">psia</option>
                                  <option value="kPa_a">kPa a</option>
                                  <option value="bar_g">bar g</option>
                                  <option value="psig">psig</option>
                                </select>
                                <InfoTooltip
                                  label="P2 Outlet Pressure"
                                  text="Downstream absolute outlet pressure at the valve outlet flange. ΔP = P1 − P2; also drives cavitation index σ and flashing checks."
                                  align="right"
                                />
                              </div>
                            </div>
                          </th>
                          {operatingCases.map((c, idx) => {
                            const displayP2 = Number(fromInternalPressure(c.P2_bar_a, processUnits.P2).toFixed(2));
                            const orificeShare =
                              enableBackpressureOrifice && backpressureOrificeResult
                                ? backpressureOrificeResult.caseShares.find((s) => s.id === c.id)
                                : undefined;
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
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                                />
                                {orificeShare && (
                                  <span className="block text-[9px] font-mono text-[#0f8b8d] mt-0.5">
                                    P2*={Number(fromInternalPressure(orificeShare.midPressurePmid_bar_a, processUnits.P2).toFixed(2))}
                                  </span>
                                )}
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
                                  className="bg-[#edf1f5] border border-[#cfd8e3] text-[#0f8b8d] font-bold rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                                  title="Change Temperature display unit with auto-conversion"
                                >
                                  <option value="degC">°C</option>
                                  <option value="degF">°F</option>
                                  <option value="K">K</option>
                                  <option value="degR">°R</option>
                                </select>
                                <InfoTooltip
                                  label="T1 Inlet Temperature"
                                  text="Upstream flowing fluid temperature. Used for ASME B16.34 pressure-temperature rating, gas density, sonic velocity, and thermal expansion."
                                  align="right"
                                />
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
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                                  className="bg-[#edf1f5] border border-[#cfd8e3] text-[#0f8b8d] font-bold rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                                  title="Change Liquid Density display unit with auto-conversion"
                                >
                                  <option value="kg_m3">kg/m³</option>
                                  <option value="lb_ft3">lb/ft³</option>
                                  <option value="sg">SG (rel water)</option>
                                </select>
                                <InfoTooltip
                                  label="Density / Molecular Weight"
                                  text="For Liquid: flowing density ρ in kg/m³, lb/ft³, or Specific Gravity (SG). For Gas/Steam: molecular weight MW in kg/kmol. Two-Phase displays both ρ_L and MW_g."
                                  placement="top"
                                  align="right"
                                />
                              </div>
                            </div>
                          </th>
                          {operatingCases.map((c, idx) => (
                            <td key={c.id} className="py-2 px-2.5">
                              {c.fluidPhase === 'TWO_PHASE' ? (
                                <div className="grid grid-cols-2 gap-1">
                                  <div>
                                    <span className="block text-[9px] text-slate-500">ρ_L</span>
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
                                      className="w-full bg-white border border-[#cfd8e3] rounded px-1.5 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                                      title={`Liquid Density (${processUnits.density})`}
                                    />
                                  </div>
                                  <div>
                                    <span className="block text-[9px] text-slate-500">MW_g</span>
                                    <input
                                      type="number"
                                      step="0.1"
                                      value={c.molecularWeight}
                                      onChange={(e) => {
                                        const next = [...operatingCases];
                                        next[idx].molecularWeight = Number(e.target.value);
                                        setOperatingCases(next);
                                      }}
                                      className="w-full bg-white border border-[#cfd8e3] rounded px-1.5 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                                      title="Vapor/Gas Molecular Weight (kg/kmol)"
                                    />
                                  </div>
                                </div>
                              ) : c.fluidPhase === 'LIQUID' ? (
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
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                                  className="bg-[#edf1f5] border border-[#cfd8e3] text-[#0f8b8d] font-bold rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                                  title="Change Vapor/Critical Pressure display unit with auto-conversion"
                                >
                                  <option value="bar_a">bar a</option>
                                  <option value="psia">psia</option>
                                  <option value="kPa_a">kPa a</option>
                                </select>
                                <InfoTooltip
                                  label="Vapor Pressure / Gamma"
                                  text="For Liquid: fluid vapor pressure Pv at T1 (governs choked ΔP and cavitation/flashing). For Gas/Steam: specific heat ratio γ = Cp/Cv. Two-Phase displays both Pv and γ."
                                  placement="top"
                                  align="right"
                                />
                              </div>
                            </div>
                          </th>
                          {operatingCases.map((c, idx) => (
                            <td key={c.id} className="py-2 px-2.5">
                              {c.fluidPhase === 'TWO_PHASE' ? (
                                <div className="grid grid-cols-2 gap-1">
                                  <div>
                                    <span className="block text-[9px] text-slate-500">Pv</span>
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
                                      className="w-full bg-white border border-[#cfd8e3] rounded px-1.5 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                                      title={`Vapor Pressure Pv (${processUnits.Pv})`}
                                    />
                                  </div>
                                  <div>
                                    <span className="block text-[9px] text-slate-500">γ</span>
                                    <input
                                      type="number"
                                      step="0.02"
                                      value={c.gammaCpCv}
                                      onChange={(e) => {
                                        const next = [...operatingCases];
                                        next[idx].gammaCpCv = Number(e.target.value);
                                        setOperatingCases(next);
                                      }}
                                      className="w-full bg-white border border-[#cfd8e3] rounded px-1.5 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                                      title="Specific Heat Ratio Cp/Cv"
                                    />
                                  </div>
                                </div>
                              ) : c.fluidPhase === 'LIQUID' ? (
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
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                                  title="Specific Heat Ratio Cp/Cv"
                                />
                              )}
                            </td>
                          ))}
                        </tr>

                        {operatingCases.some((c) => c.fluidPhase === 'LIQUID' || c.fluidPhase === 'TWO_PHASE') && (
                          <tr className="hover:bg-[#f8fafc]">
                            <th className="py-2 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                              {renderParamLabel(
                                `Pc (${processUnits.Pv}) / c_L (m/s)`,
                                'Thermodynamic critical pressure Pc (sets IEC 60534-2-1 critical ratio FF = 0.96 - 0.28*sqrt(Pv/Pc)) and liquid speed of sound c_L (drives Joukowsky surge pressure).',
                                'top'
                              )}
                            </th>
                            {operatingCases.map((c, idx) => (
                              <td key={c.id} className="py-2 px-2.5">
                                {c.fluidPhase === 'LIQUID' || c.fluidPhase === 'TWO_PHASE' ? (
                                  <div className="grid grid-cols-2 gap-1">
                                    <div>
                                      <span className="block text-[9px] text-slate-500">Pc</span>
                                      <input
                                        type="number"
                                        step="any"
                                        value={Number(fromInternalPressure(c.Pc_bar_a, processUnits.Pv).toFixed(2))}
                                        onChange={(e) => {
                                          const next = [...operatingCases];
                                          const val = Number(e.target.value);
                                          next[idx].Pc_bar_a = Number(toInternalPressure(val, processUnits.Pv).toFixed(3));
                                          setOperatingCases(next);
                                        }}
                                        className="w-full bg-white border border-[#cfd8e3] rounded px-1.5 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                                        title={`Critical Pressure Pc (${processUnits.Pv})`}
                                      />
                                    </div>
                                    <div>
                                      <span className="block text-[9px] text-slate-500">c_L</span>
                                      <input
                                        type="number"
                                        step="10"
                                        value={c.speedOfSound_m_s}
                                        onChange={(e) => {
                                          const next = [...operatingCases];
                                          next[idx].speedOfSound_m_s = Number(e.target.value);
                                          setOperatingCases(next);
                                        }}
                                        className="w-full bg-white border border-[#cfd8e3] rounded px-1.5 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                                        title="Fluid Speed of Sound c_L (m/s) for Joukowsky Water-Hammer"
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <span className="text-slate-400 text-[11px]">—</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        )}

                        <tr className="hover:bg-[#f8fafc]">
                          <th className="py-2 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                            <div className="flex items-center justify-between gap-2">
                              <span>ν ({processUnits.viscosity}) / Z</span>
                              <div className="flex items-center gap-1">
                                <select
                                  value={processUnits.viscosity}
                                  onChange={(e) => setProcessUnits({ ...processUnits, viscosity: e.target.value as ViscosityUnit })}
                                  className="bg-[#edf1f5] border border-[#cfd8e3] text-[#0f8b8d] font-bold rounded px-1.5 py-0.5 text-[10px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                                  title="Change Viscosity display unit with auto-conversion"
                                >
                                  <option value="cSt">cSt (mm²/s)</option>
                                  <option value="SSU">SSU</option>
                                  <option value="cP">cP</option>
                                </select>
                                <InfoTooltip
                                  label="Viscosity / Compressibility Z"
                                  text="For Liquid: kinematic viscosity ν (used for IEC 60534-2-1 Reynolds correction F_R). For Gas/Steam: compressibility factor Z. Two-Phase displays both ν and Z."
                                  placement="top"
                                  align="right"
                                />
                              </div>
                            </div>
                          </th>
                          {operatingCases.map((c, idx) => (
                            <td key={c.id} className="py-2 px-2.5">
                              {c.fluidPhase === 'TWO_PHASE' ? (
                                <div className="grid grid-cols-2 gap-1">
                                  <div>
                                    <span className="block text-[9px] text-slate-500">ν</span>
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
                                      className="w-full bg-white border border-[#cfd8e3] rounded px-1.5 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                                      title={`Kinematic Viscosity (${processUnits.viscosity})`}
                                    />
                                  </div>
                                  <div>
                                    <span className="block text-[9px] text-slate-500">Z</span>
                                    <input
                                      type="number"
                                      step="0.02"
                                      value={c.compressibilityZ}
                                      onChange={(e) => {
                                        const next = [...operatingCases];
                                        next[idx].compressibilityZ = Number(e.target.value);
                                        setOperatingCases(next);
                                      }}
                                      className="w-full bg-white border border-[#cfd8e3] rounded px-1.5 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                                      title="Compressibility Factor Z"
                                    />
                                  </div>
                                </div>
                              ) : c.fluidPhase === 'LIQUID' ? (
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
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                                  className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                                    className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                                    title="Gas/Vapor Mass Fraction fg (0.001–0.99)"
                                  />
                                ) : (
                                  <span className="text-slate-400 text-[11px]">—</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        )}

                        {/* LIVE CALCULATED OUTPUT SUMMARY ROWS (TRIMMED TO CV & TRAVEL; DETAILED DIAGNOSTICS BELOW) */}
                        <tr className="bg-[#0f1419] text-slate-200 border-t-2 border-[#2f3b47]">
                          <th className="py-2.5 px-3 font-semibold text-[#ffd77a] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-[#0f1419] border-r border-[#2f3b47]">
                            {renderParamLabel(
                              'Calculated Req. Cv',
                              'Required IEC 60534-2-1 flow coefficient (Cv / Kv) for this operating condition (uses coupled P_mid when Backpressure Orifice is enabled).',
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
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>

            {/* CARD 3: AUTOMATED VALVE SIZE & PRESSURE CLASS SELECTION CARD */}
            <div className="dy-card overflow-hidden dy-defer-section">
              <div className="section-band px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#0b2545] border border-[#f2a900]/60 flex items-center justify-center text-[#8be0a8]">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                      3. Multi-Condition Valve Sizing &amp; Selection Analysis
                      <span className="px-2 py-0.5 rounded bg-[#182028] text-[#8be0a8] border border-[#2f3b47] font-mono text-[10px] font-semibold">
                        ALL CONDITIONS ACCOMMODATED IN ONE VALVE
                      </span>
                    </h2>
                    <p className="text-xs text-slate-300 font-mono">
                      Calculates actual required Cv per condition, checks pressure &amp; temperature limits, and selects optimal standard size on{' '}
                      {charConfig.type.replace(/_/g, ' ')} characteristic
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCandidateComparison((prev) => !prev)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#182028] hover:bg-[#222d38] text-slate-200 border border-[#2f3b47] font-mono font-semibold text-xs transition"
                  >
                    {showCandidateComparison ? (
                      <ChevronUp className="w-3.5 h-3.5 text-[#ffd77a]" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5 text-[#ffd77a]" />
                    )}
                    Compare All DN Sizes ({valveRecommendation.allSizesFeasible.length})
                  </button>
                  <button
                    onClick={() => {
                      handleSelectSizeFromSchedule(valveRecommendation.recommendedDN);
                      setPressureClass(valveRecommendation.recommendedPressureClass);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0f8b8d] hover:bg-[#0d7678] text-white font-mono font-semibold text-xs transition shadow-sm"
                  >
                    Apply Recommended Valve: DN{valveRecommendation.recommendedDN} ({valveRecommendation.recommendedNPS}){' '}
                    {PRESSURE_CLASSES[valveRecommendation.recommendedPressureClass].label.split('/')[0]}
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
                      {charConfig.type.replace(/_/g, ' ')} (Ideal 15%–85%)
                    </span>
                  </div>

                  <div className="instrument-tile rounded-lg p-3">
                    <span className="block text-[10px] font-mono text-slate-400 uppercase">Max Predicted Noise</span>
                    <span className="text-base font-mono font-bold text-[#7fe0e2]">
                      {caseResults.length > 0 ? Math.max(...caseResults.map((c) => c.noiseDrilledCage_dBA)) : 0} dBA
                    </span>
                    <span className="block text-[10px] font-mono text-slate-400">
                      Std trim: {caseResults.length > 0 ? Math.max(...caseResults.map((c) => c.noiseStandardTrim_dBA)) : 0} dBA
                    </span>
                  </div>
                </div>

                {/* Collapsible Candidate DN Size Comparison Table */}
                {showCandidateComparison && valveRecommendation.allSizesFeasible.length > 0 && (
                  <div className="overflow-x-auto border border-[#cfd8e3] rounded-lg">
                    <table className="w-full text-left border-collapse text-xs font-mono">
                      <thead>
                        <tr className="bg-[#edf1f5] border-b border-[#cfd8e3] text-[#13315c]">
                          <th className="py-2 px-3">Size (DN / NPS)</th>
                          <th className="py-2 px-2">Rated Cv</th>
                          <th className="py-2 px-2">Min % Open</th>
                          <th className="py-2 px-2">Max % Open</th>
                          <th className="py-2 px-2">3-Yr LCC (£)</th>
                          <th className="py-2 px-2">Status &amp; Rationale</th>
                          <th className="py-2 px-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e2e8f0]">
                        {valveRecommendation.allSizesFeasible.map((cand) => {
                          const isCurrent = cand.dn === selectedDN;
                          const isRec = cand.dn === valveRecommendation.recommendedDN;
                          return (
                            <tr
                              key={cand.dn}
                              className={
                                isCurrent
                                  ? 'bg-[#0f8b8d]/10 font-semibold'
                                  : 'hover:bg-[#f8fafc]'
                              }
                            >
                              <td className="py-2 px-3 text-[#0b2545] whitespace-nowrap">
                                DN{cand.dn} ({cand.nps})
                                {isRec && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#0f8b8d] text-white text-[9px]">
                                    REC
                                  </span>
                                )}
                                {isCurrent && (
                                  <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#13315c] text-[#ffd77a] text-[9px]">
                                    ACTIVE
                                  </span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-[#0f8b8d] font-bold">{cand.ratedCv}</td>
                              <td className="py-2 px-2">{cand.minPercentOpen}%</td>
                              <td className="py-2 px-2">{cand.maxPercentOpen}%</td>
                              <td className="py-2 px-2 text-slate-700">
                                £{Math.round(cand.sibandaTotalLifeCycleCost_GBP).toLocaleString()}
                              </td>
                              <td className="py-2 px-2">
                                <span
                                  className={`mr-2 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                    cand.isSuitable
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {cand.isSuitable ? 'PASS' : 'OUT OF SPAN'}
                                </span>
                                <span className="text-[11px] text-slate-600">{cand.reason}</span>
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleSelectSizeFromSchedule(cand.dn)}
                                  disabled={isCurrent}
                                  className={`px-2.5 py-1 rounded text-[11px] font-semibold transition ${
                                    isCurrent
                                      ? 'bg-slate-200 text-slate-500 cursor-default'
                                      : 'bg-[#13315c] hover:bg-[#0f8b8d] text-white'
                                  }`}
                                >
                                  {isCurrent ? 'Active' : 'Select'}
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

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

            {/* CARD 4: IEC 60534 SIZING, CAVITATION, VELOCITY & ACOUSTIC NOISE DIAGNOSTIC MATRIX */}
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

                      <tr className="hover:bg-[#f8fafc] bg-[#f8fafc]/60">
                        <th className="py-2.5 px-3 font-semibold text-[#0f8b8d] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-[#f8fafc] border-r border-[#cfd8e3]">
                          Local 3D Flank / Row-1 σ_min (Sibanda 2022)
                        </th>
                        {caseResults.map((r) => (
                          <td key={r.id} className="py-2.5 px-3">
                            {r.fluidPhase === 'LIQUID' ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span
                                  className={`font-bold ${
                                    r.localCavitationRiskWarning
                                      ? 'text-amber-600'
                                      : r.localFlankSigma_min < r.sigmaIncipient_i
                                      ? 'text-red-600'
                                      : 'text-emerald-700'
                                  }`}
                                >
                                  σ_loc={r.localFlankSigma_min}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  (vs σ_i={r.sigmaIncipient_i})
                                </span>
                                {r.localCavitationRiskWarning && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-100 border border-amber-300 text-amber-800 text-[9.5px] font-bold">
                                    LOCAL CAV ONSET
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">N/A ({r.fluidPhase})</span>
                            )}
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
                          Body Vel / Mach / API 14E
                        </th>
                        {caseResults.map((r) => (
                          <td key={r.id} className="py-2.5 px-3">
                            <div className="flex flex-col">
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
                              <span
                                className={`text-[10px] ${
                                  r.erosionalVelocityRatio > 1.0
                                    ? 'text-red-600 font-bold'
                                    : 'text-slate-500'
                                }`}
                              >
                                Ve={r.erosionalVelocity_m_s} m/s ({r.erosionalVelocityRatio}x)
                                {r.expandedOutletRecommended ? ' • Exp. Outlet' : ''}
                              </span>
                            </div>
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-[#f8fafc]">
                        <th className="py-2.5 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                          Trim Exit / Vena Contracta
                        </th>
                        {caseResults.map((r) => {
                          const trimVelWarn = r.trimExitVelocity_m_s > 30;
                          return (
                            <td key={r.id} className="py-2.5 px-3">
                              <div className="flex flex-col">
                                <span className={trimVelWarn ? 'text-amber-600 font-bold' : 'text-[#0b2545] font-semibold'}>
                                  {r.trimExitVelocity_m_s} m/s
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  U_vc: {r.venaContractaVelocity_m_s} m/s
                                </span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>

                      <tr className="hover:bg-[#f8fafc] bg-[#f8fafc]/60">
                        <th className="py-2.5 px-3 font-semibold text-[#0f8b8d] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-[#f8fafc] border-r border-[#cfd8e3]">
                          Row-1 Peak Vel / K1 &amp; FTO-FTC Physics
                        </th>
                        {caseResults.map((r) => (
                          <td key={r.id} className="py-2.5 px-3" title={r.flowDirectionRecommendation}>
                            <div className="flex flex-col gap-0.5">
                              <span
                                className={`font-semibold ${
                                  r.ftoWallImpingementWarning ? 'text-red-600 font-bold' : 'text-[#0b2545]'
                                }`}
                              >
                                {r.row1PeakVelocity_m_s} m/s{' '}
                                <span className="text-[10px] text-slate-500 font-normal">
                                  (K₁={r.row1ResistanceK})
                                </span>
                              </span>
                              {r.ftoWallImpingementWarning ? (
                                <span className="px-1.5 py-0.5 rounded bg-red-100 border border-red-300 text-red-700 text-[9.5px] font-bold w-fit">
                                  FTO WALL IMPINGEMENT → USE FTC
                                </span>
                              ) : (
                                <span className="text-[10px] text-[#0f8b8d] font-semibold">
                                  {flowDirection} Direction OK
                                </span>
                              )}
                            </div>
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-[#f8fafc] bg-[#f8fafc]/60">
                        <th className="py-2.5 px-3 font-semibold text-[#0f8b8d] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-[#f8fafc] border-r border-[#cfd8e3]">
                          4-Quad Void Maldistribution (Singh 2020)
                        </th>
                        {caseResults.map((r) => (
                          <td key={r.id} className="py-2.5 px-3">
                            {r.multiphaseQuadrantMaldistributionPct > 0 ? (
                              <span className="font-bold text-amber-700">
                                ±{r.multiphaseQuadrantMaldistributionPct}% void skew
                              </span>
                            ) : (
                              <span className="text-slate-500">
                                {methodologyMode === 'CONVENTIONAL_1D'
                                  ? '0% (1D Homogeneous)'
                                  : '0% (Single-Phase)'}
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>

                      <tr className="hover:bg-[#f8fafc]">
                        <th className="py-2.5 px-3 font-semibold text-[#13315c] sticky left-0 z-10 hover:z-30 focus-within:z-30 bg-white border-r border-[#cfd8e3]">
                          Trim Kinetic Energy Head
                        </th>
                        {caseResults.map((r) => {
                          const keHigh = r.trimKineticEnergy_psi > 70;
                          return (
                            <td key={r.id} className="py-2.5 px-3">
                              <span className={keHigh ? 'text-amber-600 font-bold' : 'text-[#0b2545]'}>
                                {r.trimKineticEnergy_kPa} kPa
                              </span>
                              <span className="ml-1 text-[10px] text-slate-500">
                                ({r.trimKineticEnergy_psi} psi)
                              </span>
                            </td>
                          );
                        })}
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

                {/* Steam Turbine Bypass / PRDS IAPWS-IF97 Summary Strip */}
                {caseResults.some((r) => r.fluidPhase === 'STEAM') && (
                  <div className="bg-[#f0f7fa] border border-[#b9d9e2] rounded-xl p-3.5 text-xs font-mono space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-bold text-[#0b2545] uppercase tracking-wide text-[11px]">
                        IAPWS-IF97 Steam Throttling, PRDS Attemperation & Diffuser Split
                      </span>
                      <span className="text-[11px] text-[#0f8b8d] font-semibold">
                        Regions 1–4 Active (Subcritical & Supercritical)
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                      {caseResults
                        .filter((r) => r.fluidPhase === 'STEAM')
                        .map((r) => (
                          <div
                            key={`steam-${r.id}`}
                            className="bg-white border border-[#cfd8e3] rounded-lg p-2.5 space-y-1"
                          >
                            <div className="flex items-center justify-between font-bold text-[#0b2545]">
                              <span>{r.label}</span>
                              <span className="text-[#0f8b8d]">h₁={r.steamInletEnthalpy_kJ_kg} kJ/kg</span>
                            </div>
                            <div className="text-slate-600">
                              Throttled T₂: <strong className="text-[#0b2545]">{r.steamThrottledOutletTemp_degC} °C</strong>
                              {r.steamOutletQuality < 1 && (
                                <span className="text-amber-700 ml-1">
                                  (Wet x={r.steamOutletQuality})
                                </span>
                              )}
                            </div>
                            {piping.desuperheaterEnabled && (
                              <div className="text-slate-600">
                                Spray: <strong className="text-[#0b2545]">{r.sprayWaterFlow_kg_h} kg/h</strong> (Cv {r.sprayRequiredCv}) → Out{' '}
                                <strong className="text-[#0b2545]">{r.outletTempAfterSpray_degC} °C</strong> (SH +{r.superheatMargin_degC} °C)
                              </div>
                            )}
                            {piping.downstreamDiffuserEnabled && (
                              <div className="text-slate-600">
                                P_int: <strong className="text-[#0b2545]">{r.intermediatePressure_bar_a} bar a</strong> | Diff ΔP{' '}
                                {r.diffuserDeltaP_bar} bar | Combined{' '}
                                <strong className="text-[#0b2545]">{r.combinedBypassNoise_dBA} dBA</strong>
                              </div>
                            )}
                            {(r.sprayWaterWarning || r.diffuserBottleneckWarning) && (
                              <div className="text-amber-700 text-[11px] font-semibold">
                                {r.sprayWaterWarning || 'Diffuser Cv bottlenecked: P_int approaches P1.'}
                              </div>
                            )}
                          </div>
                        ))}
                    </div>
                  </div>
                )}

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

            {/* DOWNSTREAM BACKPRESSURE ORIFICE / DIFFUSER PRESSURE-SHARING CALCULATOR */}
            <div className="dy-card overflow-hidden">
              <div className="section-band px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-[#0b2545] border border-[#f2a900]/60 flex items-center justify-center text-[#7fe0e2]">
                    <Layers className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-white flex items-center gap-2 flex-wrap">
                      Downstream Backpressure Orifice / Diffuser Pressure-Sharing Calculator (Parcol / Masoneilan)
                      {enableBackpressureOrifice && (
                        <span className="px-2 py-0.5 rounded bg-[#0f8b8d] text-white font-mono text-[10px] font-semibold">
                          CLOSED-LOOP P2* ACTIVE IN SIZING
                        </span>
                      )}
                    </h2>
                    <p className="text-xs text-slate-300 font-mono">
                      Raises valve outlet P2* (P_mid) using a downstream fixed orifice/diffuser — actively coupled into Card 2–4 sizing, cavitation σ & noise when enabled
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
                    Note: Orifice ΔP scales quadratically with flow (Q²). Enabling this feeds P_mid (P2*) directly into IEC 60534 sizing above, shifting cavitation & supersonic expansion to the restriction plate while low-flow turndown retains ~full system ΔP on the valve.
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
                            <th className="py-2 px-2">Valve σ (Before → After)</th>
                            <th className="py-2 px-2">Orifice σ / Choke Check</th>
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
                              <td className="py-2 px-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className={s.orificeChokedWarning ? 'text-[#ffd77a] font-bold' : 'text-[#8be0a8]'}>
                                    σ_o={s.orificeSigma}
                                  </span>
                                  {s.orificeChokedWarning ? (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-500/40 text-[#ffd77a] text-[10px]">
                                      WARNING: Orifice Choked/Cavitating — Consider 2-Stage Diffuser
                                    </span>
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-emerald-950/50 border border-emerald-500/40 text-[#8be0a8] text-[10px]">
                                      PASS
                                    </span>
                                  )}
                                </div>
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
                      className="w-full bg-white border border-[#cfd8e3] rounded-lg px-3 py-2 text-xs font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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

                  {/* Valve Authority Pv Slider & Auto-Sync Control */}
                  <div className="bg-[#edf1f5] border border-[#cfd8e3] rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2 text-xs font-mono">
                      <span className="text-[#13315c] font-semibold">
                        Valve Authority P_v = ΔP_min / ΔP_max
                      </span>
                      <span className="text-[#0f8b8d] font-bold">
                        {effectiveCharConfig.valveAuthorityPv.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-[11px] font-mono">
                      <label className="inline-flex items-center gap-1.5 text-[#13315c] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={autoSyncPv}
                          onChange={(e) => setAutoSyncPv(e.target.checked)}
                          className="rounded accent-[#0f8b8d]"
                        />
                        <span>Auto-Sync Pv from Process Cases</span>
                      </label>
                      <span className="px-1.5 py-0.5 rounded bg-white border border-[#cfd8e3] text-[#0b2545] font-semibold">
                        System Pv = {derivedSystemPv.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0.05"
                      max="0.95"
                      step="0.01"
                      value={effectiveCharConfig.valveAuthorityPv}
                      onChange={(e) => {
                        setAutoSyncPv(false);
                        setCharConfig({
                          ...charConfig,
                          valveAuthorityPv: Number(e.target.value),
                        });
                      }}
                      className="w-full accent-[#0f8b8d]"
                    />
                    <p className="text-[11px] font-mono text-slate-600">
                      {autoSyncPv
                        ? 'Synced to active process ΔP ratio. Drag slider to override manually.'
                        : 'Manual Pv override active. Low Pv (<0.30) flattens Linear trims.'}
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
                        className="w-full bg-white border border-[#cfd8e3] rounded px-3 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                          className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-xs font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                          className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1 text-xs font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                      {effectiveCharConfig.valveAuthorityPv.toFixed(2)})
                    </h3>
                    <p className="text-xs text-slate-300 font-mono">
                      Teal = Inherent φ(h) | Mint = Installed Flow Q(h) | Amber Dots = Process Cases (C1..Cn) on Installed Flow
                    </p>
                  </div>
                </div>

                <div className="p-4">
                  <div className="instrument-panel rounded-lg p-4">
                    <svg viewBox="0 0 680 280" role="img" className="w-full h-64 overflow-visible">
                      <title>Inherent vs. Installed Valve Flow Characteristic Curve</title>
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

                      {/* Plot Operating Cases on the Installed Flow Curve (#ffd77a) */}
                      {caseResults.map((c, idx) => {
                        const h = Math.min(100, Math.max(0, c.estimatedTravelPct));
                        const pts = charSimulation.points;
                        let instFlow = h;
                        if (pts.length > 0) {
                          if (h <= pts[0].travelPct) {
                            instFlow = pts[0].installedFlowPct;
                          } else {
                            let matched = false;
                            for (let i = 1; i < pts.length; i++) {
                              if (h <= pts[i].travelPct) {
                                const p0 = pts[i - 1];
                                const p1 = pts[i];
                                const t = (h - p0.travelPct) / Math.max(1e-6, p1.travelPct - p0.travelPct);
                                instFlow = p0.installedFlowPct + t * (p1.installedFlowPct - p0.installedFlowPct);
                                matched = true;
                                break;
                              }
                            }
                            if (!matched) instFlow = pts[pts.length - 1].installedFlowPct;
                          }
                        }
                        const cx = 50 + (h / 100) * 590;
                        const cy = 245 - (Math.min(100, Math.max(0, instFlow)) / 100) * 215;
                        const anchorEnd = h > 72;
                        return (
                          <g key={c.id}>
                            <title>{`${c.label}: Travel ${c.estimatedTravelPct}%, Installed Flow ${instFlow.toFixed(1)}%`}</title>
                            <circle
                              cx={cx}
                              cy={cy}
                              r="5.5"
                              fill="#ffd77a"
                              stroke="#0f1419"
                              strokeWidth="2"
                            />
                            <text
                              x={cx + (anchorEnd ? -8 : 8)}
                              y={cy + (idx % 2 === 0 ? -7 : 12)}
                              textAnchor={anchorEnd ? 'end' : 'start'}
                              fill="#ffd77a"
                              className="text-[10px] font-mono font-bold"
                            >
                              C{idx + 1}: {c.label} ({c.estimatedTravelPct}%)
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
                    Installed Loop Gain G_installed(h) &amp; EnTec [0.5, 2.0] Stability Envelope
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    Shaded Mint = [0.5, 2.0] Band (15–85% Travel) | Emerald Dot = In-Band Case | Red/Amber Dot = Out-of-Band Case
                  </p>
                </div>

                <div className="p-4">
                  <div className="instrument-panel rounded-lg p-4">
                    <svg viewBox="0 0 680 245" role="img" className="w-full h-56 overflow-visible">
                      <title>Installed Control Loop Gain and EnTec Stability Band Chart</title>
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

                      {[0, 20, 40, 60, 80, 100].map((tTick) => {
                        const x = 50 + (tTick / 100) * 590;
                        return (
                          <g key={`xt-${tTick}`}>
                            <line
                              x1={x}
                              y1={25}
                              x2={x}
                              y2={205}
                              stroke="#2f3b47"
                              strokeDasharray="3 3"
                            />
                            <text
                              x={x}
                              y={224}
                              textAnchor="middle"
                              className="fill-slate-400 text-[10px] font-mono"
                            >
                              {tTick}%
                            </text>
                          </g>
                        );
                      })}

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

                      {/* Plot Operating Cases on Installed Gain Curve */}
                      {caseResults.map((c, idx) => {
                        const h = Math.min(100, Math.max(0, c.estimatedTravelPct));
                        const pts = charSimulation.points;
                        let instGain = 1.0;
                        if (pts.length > 0) {
                          if (h <= pts[0].travelPct) {
                            instGain = pts[0].installedGain;
                          } else {
                            let matched = false;
                            for (let i = 1; i < pts.length; i++) {
                              if (h <= pts[i].travelPct) {
                                const p0 = pts[i - 1];
                                const p1 = pts[i];
                                const t = (h - p0.travelPct) / Math.max(1e-6, p1.travelPct - p0.travelPct);
                                instGain = p0.installedGain + t * (p1.installedGain - p0.installedGain);
                                matched = true;
                                break;
                              }
                            }
                            if (!matched) instGain = pts[pts.length - 1].installedGain;
                          }
                        }
                        const inBand = instGain >= 0.5 && instGain <= 2.0;
                        const extremeGain = instGain < 0.35 || instGain > 2.5;
                        const markerColor = inBand ? '#8be0a8' : extremeGain ? '#ff8a80' : '#ffd77a';
                        const cx = 50 + (h / 100) * 590;
                        const cy = 205 - (Math.min(3.0, Math.max(0, instGain)) / 3.0) * 180;
                        const anchorEnd = h > 75;
                        return (
                          <g key={`gain-${c.id}`}>
                            <title>{`${c.label}: Travel ${c.estimatedTravelPct}%, Installed Gain = ${instGain.toFixed(2)}`}</title>
                            <circle
                              cx={cx}
                              cy={cy}
                              r="5.5"
                              fill={markerColor}
                              stroke="#0f1419"
                              strokeWidth="2"
                            />
                            <text
                              x={cx + (anchorEnd ? -8 : 8)}
                              y={cy + (idx % 2 === 0 ? -7 : 12)}
                              textAnchor={anchorEnd ? 'end' : 'start'}
                              fill={markerColor}
                              className="text-[10px] font-mono font-bold"
                            >
                              C{idx + 1} (G={instGain.toFixed(2)})
                            </text>
                          </g>
                        );
                      })}
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
                  {/* Tab 3 Methodology Mode Toggle & Manufacturer Downsizing Readiness Banner */}
                  <div className="bg-[#182028] rounded-lg p-3 border border-[#2f3b47] space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10.5px] font-mono font-bold text-[#ffd77a] uppercase">
                        Synthesis Mode ({flowDirection})
                      </span>
                      <div className="inline-flex rounded p-0.5 bg-[#0f1419] border border-[#2f3b47]">
                        <button
                          type="button"
                          onClick={() => handleMethodologyModeChange('CONVENTIONAL_1D')}
                          className={`px-2 py-0.5 rounded text-[10.5px] font-mono font-semibold transition ${
                            methodologyMode === 'CONVENTIONAL_1D'
                              ? 'bg-[#f2a900] text-[#0b2545]'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          Conv. 1D
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMethodologyModeChange('ADVANCED_LOCAL_3D')}
                          className={`px-2 py-0.5 rounded text-[10.5px] font-mono font-semibold transition ${
                            methodologyMode === 'ADVANCED_LOCAL_3D'
                              ? 'bg-[#0f8b8d] text-white'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          Adv. 3D Local
                        </button>
                      </div>
                    </div>

                    <div className="text-[10.5px] font-mono text-slate-200 flex items-center justify-between gap-2">
                      <span>Effective 3D Trim Capacity Gain:</span>
                      <strong className="text-[#8be0a8]">
                        +{cageSynthesis.advancedCapacityGainPct}% Cv
                      </strong>
                    </div>
                    <div
                      className={`text-[10.5px] font-mono px-2 py-1 rounded border ${
                        cageSynthesis.canDownsizeValveBody
                          ? 'bg-emerald-950/50 border-emerald-500/40 text-[#8be0a8]'
                          : 'bg-[#0f1419] border-[#2f3b47] text-slate-300'
                      }`}
                    >
                      {cageSynthesis.downsizeCandidateLabel}
                    </div>
                  </div>

                  {/* Cage Area Saturation / Valve Upsize Recommended Diagnostic Alert */}
                  {cageSynthesis.saturationSeverity !== 'OPTIMAL' && (
                    <div
                      className={`p-3.5 rounded-lg border flex items-start gap-3 ${
                        cageSynthesis.saturationSeverity === 'SATURATED_UPSIZE_RECOMMENDED'
                          ? 'bg-[#ffebee] border-[#ff8a80] text-[#b71c1c]'
                          : 'bg-[#fff8e1] border-[#ffe082] text-[#e65100]'
                      }`}
                    >
                      <AlertTriangle
                        className={`w-5 h-5 shrink-0 mt-0.5 ${
                          cageSynthesis.saturationSeverity === 'SATURATED_UPSIZE_RECOMMENDED'
                            ? 'text-[#d32f2f]'
                            : 'text-[#f57c00]'
                        }`}
                      />
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold font-mono uppercase tracking-wide">
                            {cageSynthesis.saturationSeverity === 'SATURATED_UPSIZE_RECOMMENDED'
                              ? 'Cage Area Saturation / Upsize Recommended'
                              : cageSynthesis.saturationSeverity === 'TRIM_DEFICIT_INCREASE_HOLES'
                              ? 'Drilled Trim Capacity Deficit — Extend Stroke or Adjust Spacing'
                              : 'High Perforation Density / Margin Warning'}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/80 border border-current font-bold">
                            Perforation: {cageSynthesis.perforationRatioPct}% of Gross Cylinder
                          </span>
                          {cageSynthesis.recommendedMinValveSize && (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#13315c] text-white font-bold">
                              Recommended Valve: ≥ {cageSynthesis.recommendedMinValveSize}
                            </span>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed font-sans">
                          {cageSynthesis.saturationMessage}
                        </p>
                      </div>
                    </div>
                  )}

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
                          className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                            className="bg-white border border-[#cfd8e3] rounded px-2 py-1.5 text-xs font-mono text-[#0f8b8d] font-bold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d] shrink-0"
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
                        onChange={(e) => handleCageMaterialChange(e.target.value as CageMaterialId)}
                        className="w-full bg-white border border-[#cfd8e3] rounded-lg px-3 py-2 text-xs font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                      >
                        {Object.values(CAGE_MATERIALS).map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name} (Sm={m.Sm_20C_MPa} MPa | {m.hardnessHRC})
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] font-mono text-slate-500 mt-1">
                        Auto-syncs Tab 4 Cage Alloy ({THERMAL_ALLOYS[cageAlloy].name}) &amp; anti-galling check
                      </p>
                    </div>

                    {/* Manufacturing Process & Internal Surface Roughness Derating (Singh et al., 2019) */}
                    <div>
                      <label className="block text-xs font-mono text-[#13315c] font-semibold mb-1">
                        Trim Manufacturing &amp; Surface Roughness (Singh 2019 S_a / S_dr)
                      </label>
                      <select
                        value={manufacturingProcess}
                        disabled={methodologyMode === 'CONVENTIONAL_1D'}
                        onChange={(e) =>
                          setManufacturingProcess(e.target.value as TrimManufacturingProcessId)
                        }
                        className="w-full bg-white border border-[#cfd8e3] rounded-lg px-3 py-2 text-xs font-mono text-[#0b2545] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d] disabled:opacity-60"
                      >
                        {Object.values(TRIM_MANUFACTURING_PROCESSES).map((mp) => (
                          <option key={mp.id} value={mp.id}>
                            {mp.label} (Cd×{mp.capacityFactor})
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] font-mono text-slate-500 mt-1">
                        S_a = {cageSynthesis.surfaceRoughnessSa_um} µm | S_dr ={' '}
                        {cageSynthesis.surfaceAreaRatioSdr_pct}% | Applied Capacity Factor:{' '}
                        <strong className="text-[#0f8b8d]">
                          {cageSynthesis.surfaceRoughnessCapacityFactor}x
                        </strong>
                      </p>
                    </div>

                    {/* Multi-Stage Concentric Sleeve (1–4 Stages) & Sibanda 360° Asymmetric Drilling */}
                    <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#cfd8e3] space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-mono font-bold text-[#13315c] uppercase">
                          Concentric Sleeve Stack (ΔP Letdown)
                        </span>
                        <div className="flex gap-1">
                          {([1, 2, 3, 4] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setNumConcentricStages(st)}
                              className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${
                                numConcentricStages === st
                                  ? 'bg-[#0f8b8d] text-white border-[#0f8b8d]'
                                  : 'bg-white text-[#13315c] border-[#cfd8e3] hover:bg-slate-100'
                              }`}
                            >
                              {st}-Stage
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="grid grid-cols-1 gap-1 text-[10.5px] font-mono">
                        {cageSynthesis.concentricStages.map((s) => (
                          <div
                            key={s.stageIndex}
                            className="flex flex-wrap items-center justify-between gap-1 bg-white px-2 py-1 rounded border border-[#e2e8f0]"
                          >
                            <span className="font-bold text-[#0b2545]">
                              Stg {s.stageIndex} (ID {s.sleeveID_mm}mm)
                            </span>
                            <span className="text-slate-600">
                              A={s.targetArea_mm2}mm² ({s.areaRatioToStage1}x)
                            </span>
                            <span className="text-[#0f8b8d] font-bold">
                              ΔP={s.stageDeltaP_bar}b ({s.stagePressureDropSharePct}%)
                            </span>
                            <span
                              className={`text-[9.5px] font-bold ${
                                s.stageCavitationSafe ? 'text-emerald-700' : 'text-red-600'
                              }`}
                            >
                              P_out={s.stageOutletPressure_bar_a}b {s.stageCavitationSafe ? '>Pv' : '≤Pv'}
                            </span>
                          </div>
                        ))}
                      </div>
                      <label className="flex items-center gap-2 text-[11px] font-mono text-[#0b2545] cursor-pointer pt-1">
                        <input
                          type="checkbox"
                          disabled={methodologyMode === 'CONVENTIONAL_1D'}
                          checked={compensateGalleryAsymmetry}
                          onChange={(e) => setCompensateGalleryAsymmetry(e.target.checked)}
                          className="accent-[#0f8b8d]"
                        />
                        360° Asymmetric Sector Drilling ({flowDirection} Inverse Compensation)
                      </label>
                      {cageSynthesis.compensateGalleryAsymmetry && (
                        <div className="text-[10px] font-mono text-slate-600 bg-white px-2 py-1 rounded border border-[#e2e8f0]">
                          Sector Area Multipliers (0°→315°):{' '}
                          {cageSynthesis.sectorCompensationFactors
                            .map((f) => `${f.sectorAngleDeg}°:${f.compensatedAreaMultiplier}x`)
                            .join(' | ')}
                        </div>
                      )}
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
                          className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                          className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                          className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                          className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-xs font-mono text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                        Graduated Low-Lift Hole Ø (0.5 mm Drill Snap)
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
                          className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[11px] font-mono text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                    <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between">
                      <span className="text-slate-400">Cage Area Saturation:</span>
                      <span
                        className={
                          cageSynthesis.saturationSeverity === 'OPTIMAL'
                            ? 'text-[#8be0a8] font-bold'
                            : cageSynthesis.saturationSeverity === 'HIGH_DENSITY' ||
                              cageSynthesis.saturationSeverity === 'TRIM_DEFICIT_INCREASE_HOLES'
                            ? 'text-[#ffd77a] font-bold'
                            : 'text-[#ff8a80] font-bold'
                        }
                      >
                        {cageSynthesis.perforationRatioPct}% Open (
                        {cageSynthesis.saturationSeverity === 'OPTIMAL'
                          ? 'Optimal'
                          : cageSynthesis.saturationSeverity === 'HIGH_DENSITY'
                          ? 'High Density'
                          : cageSynthesis.saturationSeverity === 'TRIM_DEFICIT_INCREASE_HOLES'
                          ? 'Increase Hole Ø'
                          : 'Saturated - Upsize'})
                      </span>
                    </div>
                    <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between">
                      <span className="text-slate-400">Max Drill Aspect (t_cage / d_min):</span>
                      <span
                        className={
                          cageSynthesis.drillManufacturabilityStatus === 'PASS'
                            ? 'text-[#8be0a8] font-bold'
                            : cageSynthesis.drillManufacturabilityStatus === 'WARNING'
                            ? 'text-[#ffd77a] font-bold'
                            : 'text-[#ff8a80] font-bold'
                        }
                      >
                        {cageSynthesis.maxDrillAspectRatio}x ({cageSynthesis.drillManufacturabilityStatus})
                      </span>
                    </div>
                    <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between gap-2">
                      <span className="text-slate-400 shrink-0">Distinct CNC Drills (0.5mm):</span>
                      <span className="text-[#7fe0e2] font-semibold text-right">
                        {cageSynthesis.distinctDrillSizes_mm.map((d) => `Ø${d}`).join(', ')} mm ({cageSynthesis.distinctDrillSizes_mm.length})
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
                        <svg viewBox={`0 0 ${svgW} ${svgH}`} role="img" className="w-full h-80">
                          <title>2D Unrolled Drilled Cage Perforation Map and Gallery Heatmap</title>
                          {/* Direction-Aware 3D Gallery Separation / Impingement Heatmap Zones */}
                          {showSibandaGalleryHeatmap && methodologyMode === 'ADVANCED_LOCAL_3D' && (
                            <g>
                              {(flowDirection === 'FTC' ? [135, 225] : [90, 270]).map((sepDeg) => {
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
                                      {flowDirection === 'FTC'
                                        ? `${sepDeg}° VORTEX / MIN Cv`
                                        : `${sepDeg}° NECK ACCEL`}
                                    </text>
                                  </g>
                                );
                              })}
                              <text
                                x={padL + 4}
                                y={padT - 8}
                                textAnchor="start"
                                fill={flowDirection === 'FTC' ? '#8be0a8' : '#ff8a80'}
                                className="text-[8.5px] font-mono"
                              >
                                {flowDirection === 'FTC'
                                  ? '0° INLET STAGNATION PEAK'
                                  : '0° BLIND WALL IMPINGEMENT'}
                              </text>
                              <text
                                x={padL + 0.5 * plotW}
                                y={padT - 8}
                                textAnchor="middle"
                                fill={flowDirection === 'FTC' ? '#7fe0e2' : '#8be0a8'}
                                className="text-[8.5px] font-mono"
                              >
                                {flowDirection === 'FTC'
                                  ? '180° REAR COLLISION RECOVERY'
                                  : '180° OUTLET SUCTION PEAK'}
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

                            const openFrac =
                              plugZ_mm <= row.zBottom_mm
                                ? 0
                                : plugZ_mm >= row.zTop_mm
                                ? 1
                                : (plugZ_mm - row.zBottom_mm) / Math.max(0.1, row.holeDia_mm);

                            const rowHoles =
                              row.individualHoles && row.individualHoles.length > 0
                                ? row.individualHoles
                                : Array.from({ length: row.holeCount }, (_, j) => ({
                                    holeIndex: j + 1,
                                    angle_deg: (row.angularOffset_deg + (j * 360) / row.holeCount) % 360,
                                    holeDia_mm: row.holeDia_mm,
                                    localSibandaWeight: 1.0,
                                    flowZone: 'TRANSITION',
                                  }));

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
                                {rowHoles.map((hole, j) => {
                                  const cx = padL + (hole.angle_deg / 360) * plotW;
                                  const ryPx = Math.max(
                                    2.0,
                                    ((hole.holeDia_mm * 0.5) / maxZ) * plotH
                                  );
                                  const rxPx = Math.max(
                                    2.0,
                                    ((hole.holeDia_mm * 0.5) / circum) * plotW
                                  );

                                  const sibanda = evaluateSibandaLocalHoleFactor({
                                    angle_deg: hole.angle_deg,
                                    zElevation_mm: row.zElevation_mm,
                                    stroke_mm: correlatedValve.stroke_mm,
                                    holeDia_mm: hole.holeDia_mm,
                                    cageID_mm: cageSynthesis.cageID_mm,
                                    flowDirection,
                                    methodologyMode,
                                  });

                                  let strokeColor = '#2f3b47';
                                  let fillColor = '#182028';
                                  if (openFrac > 0) {
                                    if (showSibandaGalleryHeatmap && methodologyMode === 'ADVANCED_LOCAL_3D') {
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
                                      <title>{`R${row.rowIndex} H${hole.holeIndex} @ ${hole.angle_deg}° | Ø${hole.holeDia_mm} mm | Local Weight ${sibanda.relativeWeight}x (${sibanda.flowZone})`}</title>
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

                  {/* Legend for Zero-Deadband & Direction-Aware 3D Gallery Physics (Dark Instrument Tiles) */}
                  <div className="instrument-panel rounded-xl p-3 grid grid-cols-1 md:grid-cols-3 gap-3 text-[11px] font-mono">
                    <div className="instrument-tile rounded-lg p-2.5">
                      <span className="text-[#8be0a8] font-bold block">
                        1.{' '}
                        {methodologyMode === 'CONVENTIONAL_1D'
                          ? 'Conventional Uniform 1D Spacing'
                          : 'Zero Initial & Inter-Row Deadband'}
                      </span>
                      <span className="text-slate-300">
                        {methodologyMode === 'CONVENTIONAL_1D'
                          ? `Conventional uniform holes without forced overlap (${cageSynthesis.deadbandStrokePct}% axial deadband).`
                          : `Row 1 tangent to Z=0.0mm; staggered rows overlap by ${cageSynthesis.meanRowOverlapPct}% (p_z < d_h) so dA/dh > 0 everywhere.`}
                      </span>
                    </div>
                    <div className="instrument-tile rounded-lg p-2.5">
                      <span className="text-[#7fe0e2] font-bold block">
                        2. {flowDirection === 'FTC' ? 'FTC Outside→In (Sibanda 2022)' : 'FTO Inside→Out (Core Supply)'}
                      </span>
                      <span className="text-slate-300">
                        {methodologyMode === 'CONVENTIONAL_1D'
                          ? '1D mode assumes uniform circumferential & axial hole Cv = 1.00x across all holes.'
                          : flowDirection === 'FTC'
                          ? 'Crossflow around cage peaks at 0° inlet stagnation & upper rows (HT^0.150); inward jets collide at cage center.'
                          : 'Core supply exits outward: 180° outlet nozzle sees lowest backpressure (+18% flow); 0° blind wall sees high impingement.'}
                      </span>
                    </div>
                    <div className="instrument-tile rounded-lg p-2.5">
                      <span className="text-[#ffd77a] font-bold block">
                        3.{' '}
                        {flowDirection === 'FTC'
                          ? 'Flank Separation Zones (135° & 225°)'
                          : 'Seat-Lip Throat & Neck Accel (90°/270°)'}
                      </span>
                      <span className="text-slate-300">
                        {flowDirection === 'FTC'
                          ? 'Boundary-layer separation at θ ≈ 135° & 225° drops local ΔP and Cv, concentrating cavitation risk unless sector-compensated.'
                          : 'Row-1 seat-lip separation dips low-lift flow while outward liquid jets risk gallery wall impingement at 0°/90°/270°.'}
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
                        <svg viewBox="0 0 680 230" role="img" className="w-full h-52 overflow-visible">
                          <title>Drilled Cage Target vs. Synthesized Discrete Cv Curve</title>
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

              {/* Chart B: Sibanda (2022) Eq. 5.10 360° Gallery Circumferential Hole Cv Distribution (FTO vs FTC) */}
              <div className="lg:col-span-5 dy-card overflow-hidden">
                <div className="section-band px-5 py-3.5">
                  <h3 className="text-sm font-bold text-white">
                    {flowDirection === 'FTC'
                      ? 'Sibanda (2022) Ch. 5 FTC Circumferential Cv(θ) Profile'
                      : 'Masoneilan / Severn FTO Core-to-Gallery Cv(θ) Profile'}
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    {methodologyMode === 'CONVENTIONAL_1D'
                      ? 'Conventional 1D Mode: Uniform 1.00x flow distribution assumed across 0°–360°'
                      : flowDirection === 'FTC'
                      ? 'Outside→In: Inlet 0° Stagnation Peak vs. 135°/225° Flank Separation vs. 180° Rear'
                      : 'Inside→Out: 0° Blind Wall Backpressure vs. 90°/270° Neck vs. 180° Outlet Suction Peak'}
                  </p>
                </div>

                <div className="p-4">
                  <div className="instrument-panel rounded-lg p-4">
                    {(() => {
                      const angles = Array.from({ length: 73 }, (_, i) => i * 5);
                      const topRowZ = correlatedValve.stroke_mm * 0.9;
                      const botRowZ = correlatedValve.stroke_mm * 0.12;
                      return (
                        <svg viewBox="0 0 460 230" role="img" className="w-full h-52 overflow-visible">
                          <title>Circumferential Gallery Flow Distribution Polar/Linear Profile</title>
                          {[0, 90, 135, 180, 225, 270, 360].map((deg) => {
                            const x = 42 + (deg / 360) * 395;
                            const isSep =
                              methodologyMode === 'ADVANCED_LOCAL_3D' &&
                              (flowDirection === 'FTC'
                                ? deg === 135 || deg === 225
                                : deg === 0 || deg === 180);
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

                          {/* Upper Row (HT = 0.90) Directional Profile (#8be0a8) */}
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
                                  flowDirection,
                                  methodologyMode,
                                });
                                const x = 42 + (deg / 360) * 395;
                                const y = 195 - ((s.relativeWeight - 0.7) / 0.6) * 165;
                                return `${x},${y}`;
                              })
                              .join(' ')}
                          />

                          {/* Bottom Seat Row (HT = 0.12) Directional Profile (#7fe0e2) */}
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
                                  flowDirection,
                                  methodologyMode,
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

            {/* Bu, Aliyu, & Mishra (2022) 15-Plane 1D Axial Pressure & Local Cv(x/D) Surrogate Profile */}
            {cageSynthesis.axial15PlaneProfile.length > 0 && (
              <div className="dy-card overflow-hidden">
                <div className="section-band px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-white">
                      Bu, Aliyu, &amp; Mishra (2022) 15-Plane 1D Axial Pressure &amp; Local Cv(x/D) Profile
                    </h3>
                    <p className="text-xs text-slate-300 font-mono">
                      Axial static pressure P(x/D) [Teal] &amp; local jet velocity V(x/D) [Amber] from -2.0D upstream to +6.0D downstream recovery tap
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded bg-[#182028] text-[#7fe0e2] border border-[#2f3b47] text-xs font-mono font-bold">
                    {cageSynthesis.numConcentricStages}-Stage Recovery • P_vc ={' '}
                    {Math.min(...cageSynthesis.axial15PlaneProfile.map((p) => p.localStaticPressure_bar))} bar a
                  </span>
                </div>

                <div className="p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
                  <div className="lg:col-span-7 instrument-panel rounded-lg p-4">
                    {(() => {
                      const planes = cageSynthesis.axial15PlaneProfile;
                      const maxP = Math.max(1, ...planes.map((p) => p.localStaticPressure_bar)) * 1.05;
                      const maxV = Math.max(1, ...planes.map((p) => p.localVelocity_m_s)) * 1.1;
                      return (
                        <svg viewBox="0 0 680 210" role="img" className="w-full h-48 overflow-visible">
                          <title>Multi-Stage Axial Pressure and Velocity Profile</title>
                          {[0, 0.25, 0.5, 0.75, 1.0].map((frac) => {
                            const y = 175 - frac * 145;
                            return (
                              <g key={frac}>
                                <line x1={48} y1={y} x2={625} y2={y} stroke="#2f3b47" strokeDasharray="3 3" />
                                <text x={42} y={y + 3} textAnchor="end" className="fill-slate-400 text-[9.5px] font-mono">
                                  {(frac * maxP).toFixed(1)}b
                                </text>
                                <text x={632} y={y + 3} textAnchor="start" className="fill-[#ffd77a] text-[9.5px] font-mono">
                                  {(frac * maxV).toFixed(0)}m/s
                                </text>
                              </g>
                            );
                          })}

                          {/* Static Pressure Curve (#7fe0e2) */}
                          <polyline
                            fill="none"
                            stroke="#7fe0e2"
                            strokeWidth="2.5"
                            points={planes
                              .map((p, idx) => {
                                const x = 48 + (idx / (planes.length - 1)) * 577;
                                const y = 175 - (p.localStaticPressure_bar / maxP) * 145;
                                return `${x},${y}`;
                              })
                              .join(' ')}
                          />

                          {/* Local Velocity Curve (#ffd77a) */}
                          <polyline
                            fill="none"
                            stroke="#ffd77a"
                            strokeWidth="2.0"
                            strokeDasharray="5 3"
                            points={planes
                              .map((p, idx) => {
                                const x = 48 + (idx / (planes.length - 1)) * 577;
                                const y = 175 - (p.localVelocity_m_s / maxV) * 145;
                                return `${x},${y}`;
                              })
                              .join(' ')}
                          />

                          {planes.map((p, idx) => {
                            const x = 48 + (idx / (planes.length - 1)) * 577;
                            const yP = 175 - (p.localStaticPressure_bar / maxP) * 145;
                            return (
                              <g key={p.planeIndex}>
                                <title>{`Plane ${p.planeIndex} (${p.locationLabel}, x/D=${p.xOverD}): P=${p.localStaticPressure_bar} bar a | V=${p.localVelocity_m_s} m/s | Local Cv=${p.localPlaneCv}`}</title>
                                <circle cx={x} cy={yP} r="3.5" fill="#7fe0e2" stroke="#0f1419" strokeWidth="1.5" />
                                {(idx % 2 === 0 || p.xOverD === 0.05) && (
                                  <text x={x} y={195} textAnchor="middle" className="fill-slate-400 text-[8.5px] font-mono">
                                    {p.xOverD}D
                                  </text>
                                )}
                              </g>
                            );
                          })}
                        </svg>
                      );
                    })()}
                  </div>

                  <div className="lg:col-span-5 overflow-x-auto max-h-56 border border-[#cfd8e3] rounded-lg">
                    <table className="w-full text-left border-collapse text-[11px] font-mono">
                      <thead>
                        <tr className="bg-[#edf1f5] border-b border-[#cfd8e3] text-[#13315c] sticky top-0">
                          <th className="py-1.5 px-2">Plane</th>
                          <th className="py-1.5 px-2">x/D</th>
                          <th className="py-1.5 px-2">P (bar a)</th>
                          <th className="py-1.5 px-2">Vel (m/s)</th>
                          <th className="py-1.5 px-2">Local Cv</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#e2e8f0]">
                        {cageSynthesis.axial15PlaneProfile.map((p) => (
                          <tr
                            key={p.planeIndex}
                            className={p.xOverD >= 0 && p.xOverD <= 0.15 ? 'bg-amber-50/70 font-semibold' : 'hover:bg-[#f8fafc]'}
                          >
                            <td className="py-1 px-2 text-[#0b2545]">#{p.planeIndex} {p.locationLabel}</td>
                            <td className="py-1 px-2 text-slate-600">{p.xOverD}</td>
                            <td className="py-1 px-2 text-[#0f8b8d] font-bold">{p.localStaticPressure_bar}</td>
                            <td className="py-1 px-2 text-slate-700">{p.localVelocity_m_s}</td>
                            <td className="py-1 px-2 text-emerald-700">{p.localPlaneCv}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom Row: Discrete Axial Row Schedule Table */}
            <div className="dy-card overflow-hidden">
              <div className="section-band px-5 py-3.5 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Zero-Deadband Overlapping Axial Hole Row Schedule (R1 to R{cageSynthesis.rows.length})
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    Circumferential &amp; diagonal ligament pitch, axial overlap %, and Sibanda gallery elevation factors
                  </p>
                </div>
                <button
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 rounded bg-[#0f8b8d] hover:bg-[#0d7678] text-white text-xs font-mono font-semibold transition flex items-center gap-1.5"
                  title="Export Schedule as CSV"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Export .CSV Schedule
                </button>
              </div>
              <div className="p-5">
                <div className="overflow-x-auto max-h-96">
                  <table className="w-full text-left border-collapse text-xs font-mono">
                    <thead>
                      <tr className="border-b border-[#cfd8e3] text-[#13315c] bg-[#edf1f5] sticky top-0">
                        <th className="py-2 px-3">Row</th>
                        <th className="py-2 px-3">Z Center (Span mm)</th>
                        <th className="py-2 px-3">Hole Ød_k</th>
                        <th className="py-2 px-3">Count n_k</th>
                        <th className="py-2 px-3">Axial Overlap</th>
                        <th className="py-2 px-3">Pitch p_θ (p_θ/d)</th>
                        <th className="py-2 px-3">Ligament w</th>
                        <th className="py-2 px-3">Sibanda HT^c</th>
                        <th className="py-2 px-3">Cum. Cv</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#e2e8f0]">
                      {cageSynthesis.rows.map((r) => (
                        <tr key={r.rowIndex} className="hover:bg-[#f8fafc]">
                          <td className="py-2 px-3 font-bold text-[#0f8b8d]">R{r.rowIndex}</td>
                          <td className="py-2 px-3 text-[#0b2545]">
                            {r.zElevation_mm}{' '}
                            <span className="text-slate-500 text-[10px]">
                              [{r.zBottom_mm}–{r.zTop_mm}]
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[#0b2545]">
                            {(() => {
                              const dias = r.individualHoles?.map((h) => h.holeDia_mm) || [r.holeDia_mm];
                              const minD = Math.min(...dias);
                              const maxD = Math.max(...dias);
                              return minD === maxD
                                ? `Ø${r.holeDia_mm} mm`
                                : `Ø${minD}–${maxD} mm`;
                            })()}
                          </td>
                          <td className="py-2 px-3 font-bold text-[#0b2545]">{r.holeCount}</td>
                          <td className="py-2 px-3 text-emerald-700 font-semibold">
                            {r.rowIndex === 1 ? 'Seat Tangent' : `${r.axialOverlapPct}%`}
                          </td>
                          <td className="py-2 px-3 text-slate-700">
                            {r.circumferentialPitch_mm} ({r.pitchToDiaRatio}x)
                          </td>
                          <td className="py-2 px-3 text-slate-700">{r.ligamentWidth_mm} mm</td>
                          <td className="py-2 px-3 text-[#0f8b8d] font-semibold">
                            {r.sibandaRowElevationFactor}x
                          </td>
                          <td className="py-2 px-3 font-bold text-emerald-700">
                            {r.cumulativeCv}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Collapsible 4-Axis CNC G-Code (G83) & CAD/CAM Export Preview */}
            <div className="dy-card overflow-hidden">
              <div className="section-band px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <FileCode className="w-4 h-4 text-[#ffd77a]" />
                    4-Axis CNC Rotary Indexer G-Code (G83 Peck) &amp; CAD/CAM Export Preview
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    {cageSynthesis.distinctDrillSizes_mm.length} quantized drill tool(s) ({cageSynthesis.distinctDrillSizes_mm.map((d) => `Ø${d}`).join(', ')} mm) • Aspect ratio {cageSynthesis.maxDrillAspectRatio}x ({cageSynthesis.drillManufacturabilityStatus})
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportDXF}
                    className="px-2.5 py-1.5 rounded bg-[#182028] hover:bg-[#222d38] text-[#7fe0e2] border border-[#2f3b47] text-xs font-mono font-semibold transition flex items-center gap-1"
                  >
                    <Download className="w-3.5 h-3.5" />
                    .DXF
                  </button>
                  <button
                    type="button"
                    onClick={handleExportGCode}
                    className="px-2.5 py-1.5 rounded bg-[#182028] hover:bg-[#222d38] text-[#8be0a8] border border-[#2f3b47] text-xs font-mono font-semibold transition flex items-center gap-1"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    .NC G-Code
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    className="px-2.5 py-1.5 rounded bg-[#182028] hover:bg-[#222d38] text-[#ffd77a] border border-[#2f3b47] text-xs font-mono font-semibold transition flex items-center gap-1"
                  >
                    <Table className="w-3.5 h-3.5" />
                    .CSV
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGCodePreview((prev) => !prev)}
                    className="px-3 py-1.5 rounded bg-[#0f8b8d] hover:bg-[#0d7678] text-white text-xs font-mono font-semibold transition flex items-center gap-1.5"
                  >
                    {showGCodePreview ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {showGCodePreview ? 'Hide G-Code Preview' : 'Preview G-Code'}
                  </button>
                </div>
              </div>

              {showGCodePreview && (
                <div className="p-5">
                  <pre className="instrument-panel rounded-lg p-4 text-[11px] font-mono text-[#8be0a8] overflow-x-auto max-h-80 leading-relaxed whitespace-pre">
                    {generate4AxisCageGCode(cageSynthesis)}
                  </pre>
                </div>
              )}
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
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">Final Process T_∞ (°C)</label>
                      <input
                        type="number"
                        value={effectiveThermalTargetTemp_degC}
                        onChange={(e) => {
                          setSyncThermalTempWithProcess(false);
                          setFinalProcessTemp_degC(Number(e.target.value));
                        }}
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">Warmup Ramp (°C/min)</label>
                      <input
                        type="number"
                        min="0"
                        value={rampRate_degC_per_min}
                        onChange={(e) => setRampRate_degC_per_min(Number(e.target.value))}
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">Cold Radial Gap (mm)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={coldRadialClearance_mm}
                        onChange={(e) => setColdRadialClearance_mm(Number(e.target.value))}
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs font-mono text-[#0f8b8d] font-semibold pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={syncThermalTempWithProcess}
                      onChange={(e) => setSyncThermalTempWithProcess(e.target.checked)}
                      className="accent-[#0f8b8d]"
                    />
                    <Link2 className="w-3.5 h-3.5 shrink-0" />
                    Sync Final Temp with Process T1 ({processExtremeTemp_degC}°C)
                  </label>

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
                  <div className="instrument-tile rounded px-2.5 py-2 space-y-1 border border-[#2f3b47]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-slate-400">Trim Anti-Galling Check:</span>
                      {renderStatusBadge(thermalResult.gallingRisk)}
                    </div>
                    <p className="text-[11px] text-slate-300 leading-snug">
                      {thermalResult.gallingRationale}
                    </p>
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
                    Transient Thermal Lag T(t) &amp; Radial Guide Clearance c_radial(t)
                  </h3>
                  <p className="text-xs text-slate-300 font-mono">
                    Top: Component Thermal Lag (T_fluid, T_cage, T_plug, T_body °C) | Bottom: Plug-to-Cage Radial Clearance (mm)
                  </p>
                </div>

                <div className="p-4">
                  <div className="instrument-panel rounded-lg p-4">
                    {(() => {
                      const pts = thermalResult.timeSeries;
                      const maxTime = pts[pts.length - 1]?.time_s || 600;
                      const maxClearance = Math.max(
                        0.35,
                        ...pts.map((p) => p.radialClearance_mm)
                      );
                      const tempVals = pts.flatMap((p) => [
                        p.T_fluid_degC,
                        p.T_cage_degC,
                        p.T_plug_degC,
                        p.T_body_degC,
                      ]);
                      const minT = Math.min(...tempVals, initialTemp_degC, effectiveThermalTargetTemp_degC);
                      const maxT = Math.max(...tempVals, initialTemp_degC, effectiveThermalTargetTemp_degC);
                      const spanT = Math.max(20, maxT - minT);
                      const tTop = 26;
                      const tBot = 132;
                      const cTop = 166;
                      const cBot = 294;
                      const floorY =
                        cBot -
                        (thermalResult.minSafeRadialClearanceFloor_mm / maxClearance) * (cBot - cTop);

                      return (
                        <svg viewBox="0 0 680 330" role="img" className="w-full h-80 overflow-visible">
                          <title>Transient Thermal Shock Temperature and Radial Clearance Curve</title>
                          {/* Temperature Subplot Legend */}
                          <g className="text-[10px] font-mono">
                            <line x1={55} y1={11} x2={75} y2={11} stroke="#ffd77a" strokeWidth="2" strokeDasharray="4 3" />
                            <text x={80} y={14} fill="#ffd77a">T_fluid</text>
                            <line x1={145} y1={11} x2={165} y2={11} stroke="#7fe0e2" strokeWidth="2.2" />
                            <text x={170} y={14} fill="#7fe0e2">T_cage</text>
                            <line x1={235} y1={11} x2={255} y2={11} stroke="#8be0a8" strokeWidth="2.2" />
                            <text x={260} y={14} fill="#8be0a8">T_plug</text>
                            <line x1={325} y1={11} x2={345} y2={11} stroke="#94a3b8" strokeWidth="2" strokeDasharray="3 3" />
                            <text x={350} y={14} fill="#94a3b8">T_body (°C)</text>
                          </g>

                          {/* Temperature Subplot Y Grid & Ticks */}
                          {[0, 0.5, 1.0].map((f) => {
                            const y = tBot - f * (tBot - tTop);
                            const tVal = Math.round(minT + f * spanT);
                            return (
                              <g key={`tt-${f}`}>
                                <line x1={55} y1={y} x2={640} y2={y} stroke="#2f3b47" strokeDasharray="3 3" />
                                <text x={48} y={y + 3} textAnchor="end" className="fill-slate-400 text-[10px] font-mono">
                                  {tVal}°C
                                </text>
                              </g>
                            );
                          })}

                          {/* Temperature Curves */}
                          <polyline
                            fill="none"
                            stroke="#ffd77a"
                            strokeWidth="1.8"
                            strokeDasharray="4 3"
                            points={pts
                              .map((p) => {
                                const x = 55 + (p.time_s / maxTime) * 585;
                                const y = tBot - ((p.T_fluid_degC - minT) / spanT) * (tBot - tTop);
                                return `${x},${y}`;
                              })
                              .join(' ')}
                          />
                          <polyline
                            fill="none"
                            stroke="#7fe0e2"
                            strokeWidth="2.2"
                            points={pts
                              .map((p) => {
                                const x = 55 + (p.time_s / maxTime) * 585;
                                const y = tBot - ((p.T_cage_degC - minT) / spanT) * (tBot - tTop);
                                return `${x},${y}`;
                              })
                              .join(' ')}
                          />
                          <polyline
                            fill="none"
                            stroke="#8be0a8"
                            strokeWidth="2.2"
                            points={pts
                              .map((p) => {
                                const x = 55 + (p.time_s / maxTime) * 585;
                                const y = tBot - ((p.T_plug_degC - minT) / spanT) * (tBot - tTop);
                                return `${x},${y}`;
                              })
                              .join(' ')}
                          />
                          <polyline
                            fill="none"
                            stroke="#94a3b8"
                            strokeWidth="1.8"
                            strokeDasharray="3 3"
                            points={pts
                              .map((p) => {
                                const x = 55 + (p.time_s / maxTime) * 585;
                                const y = tBot - ((p.T_body_degC - minT) / spanT) * (tBot - tTop);
                                return `${x},${y}`;
                              })
                              .join(' ')}
                          />

                          {/* Clearance Subplot Label & Y Grid/Ticks (mm) */}
                          <text x={55} y={156} className="fill-[#7fe0e2] text-[10px] font-mono font-bold">
                            Radial Guide Clearance c_radial(t) (mm)
                          </text>
                          {[0, 0.5, 1.0].map((f) => {
                            const y = cBot - f * (cBot - cTop);
                            const cVal = (f * maxClearance).toFixed(2);
                            return (
                              <g key={`ct-${f}`}>
                                <line x1={55} y1={y} x2={640} y2={y} stroke="#2f3b47" strokeDasharray="3 3" />
                                <text x={48} y={y + 3} textAnchor="end" className="fill-slate-400 text-[10px] font-mono">
                                  {cVal}mm
                                </text>
                              </g>
                            );
                          })}

                          {/* Shared X-Axis Time Ticks (s) */}
                          {[0, 0.25, 0.5, 0.75, 1.0].map((f) => {
                            const x = 55 + f * 585;
                            const sec = Math.round(f * maxTime);
                            return (
                              <g key={`xt-${f}`}>
                                <line x1={x} y1={tTop} x2={x} y2={cBot} stroke="#2f3b47" strokeDasharray="2 4" />
                                <text x={x} y={314} textAnchor="middle" className="fill-slate-400 text-[10px] font-mono">
                                  {sec}s
                                </text>
                              </g>
                            );
                          })}

                          {/* Minimum Safe Clearance Floor Line (#ff8a80) */}
                          <line
                            x1={55}
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
                            ANTI-SEIZURE CLEARANCE FLOOR ({thermalResult.minSafeRadialClearanceFloor_mm} mm)
                          </text>

                          {/* Radial Clearance Curve (#7fe0e2) */}
                          <polyline
                            fill="none"
                            stroke="#7fe0e2"
                            strokeWidth="2.6"
                            points={pts
                              .map((p) => {
                                const x = 55 + (p.time_s / maxTime) * 585;
                                const y =
                                  cBot -
                                  (Math.max(0, p.radialClearance_mm) / maxClearance) * (cBot - cTop);
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
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1.5 text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2 py-1.5 text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                    >
                      <option value="FAIL_CLOSED_ATO">Fail-Closed (Spring-to-Close)</option>
                      <option value="FAIL_OPEN_ATC">Fail-Open (Air-to-Close)</option>
                    </select>
                  </div>
                </div>

                {/* Explicit Shutoff Differential Pressure Override */}
                <div className="bg-[#edf1f5] border border-[#cfd8e3] rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="text-[#13315c] font-semibold">
                      Max Shutoff ΔP (bar)
                    </label>
                    {customShutoffDeltaP_bar !== null ? (
                      <button
                        type="button"
                        onClick={() => setCustomShutoffDeltaP_bar(null)}
                        className="px-2 py-0.5 rounded bg-[#0f8b8d] text-white text-[10px] font-semibold"
                      >
                        Reset Auto ({defaultShutoffDeltaP_bar} bar)
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-600">
                        Auto (Max P1 − 1.013 atm = {defaultShutoffDeltaP_bar} bar)
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={effectiveShutoffDeltaP_bar}
                    onChange={(e) =>
                      setCustomShutoffDeltaP_bar(e.target.value ? Number(e.target.value) : null)
                    }
                    className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0f8b8d] font-bold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                  />
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
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                    />
                  </div>
                </div>

                <div className="border-t border-[#cfd8e3] pt-3 space-y-3">
                  <div>
                    <label className="block text-[#13315c] font-semibold mb-1">Stem Bar Material</label>
                    <select
                      value={stemMaterial}
                      onChange={(e) => setStemMaterial(e.target.value as StemMaterialId)}
                      className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0f8b8d] font-semibold focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
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
                        className="w-full bg-white border border-[#cfd8e3] rounded px-2.5 py-1.5 text-[#0b2545] focus:border-[#0f8b8d] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0f8b8d]"
                      />
                    </div>
                  </div>

                  {/* SIL / Functional Safety (IEC 61508 / 61511) */}
                  <div className="pt-3 border-t border-[#e2e8f0] space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 text-xs font-mono font-semibold text-[#13315c] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={silServiceEnabled}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setSilServiceEnabled(checked);
                            if (checked && targetSilLevel === 'NONE') setTargetSilLevel('SIL_2');
                            if (!checked) setTargetSilLevel('NONE');
                          }}
                          className="accent-[#0f8b8d]"
                        />
                        SIS / ESD Safety Service (IEC 61508)
                      </label>
                      {silServiceEnabled && (
                        <select
                          value={targetSilLevel}
                          onChange={(e) => setTargetSilLevel(e.target.value as 'NONE' | 'SIL_1' | 'SIL_2' | 'SIL_3')}
                          className="bg-white border border-[#cfd8e3] rounded px-2 py-1 text-xs font-mono text-[#0f8b8d] font-bold"
                        >
                          <option value="SIL_1">SIL 1</option>
                          <option value="SIL_2">SIL 2</option>
                          <option value="SIL_3">SIL 3</option>
                        </select>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Side-by-Side Unbalanced vs Balanced Thrust & Stem Buckling Verification */}
            <div className="lg:col-span-8 space-y-6">
              {/* Fugitive Emissions (ISO 15848-1), Stick-Slip Deadband (ISA-75.25) & SIL / Stroking Time */}
              <div className="dy-card overflow-hidden">
                <div className="section-band px-4 py-2.5 flex items-center justify-between">
                  <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                    Fugitive Emissions (ISO 15848-1 / API 622), Positioner Deadband (ISA-75.25) &amp; SIL / T90
                  </h3>
                  <span className="text-[11px] font-mono text-[#f2a900] font-bold">
                    Class {fugitiveEmissionsSpec.iso15848TightnessClass} • Deadband {silPositionerResult.deadbandPctOfTravel}%
                  </span>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                  <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#cfd8e3] space-y-1">
                    <div className="text-[10px] uppercase text-slate-500 font-bold">ISO 15848-1 / API 622</div>
                    <div className="font-bold text-[#0b2545]">{fugitiveEmissionsSpec.label}</div>
                    <div className="text-[11px] text-slate-600">
                      Endurance: {fugitiveEmissionsSpec.iso15848EnduranceClass} • Stem Finish: {fugitiveEmissionsSpec.stemFinishRa_um}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#cfd8e3] space-y-1">
                    <div className="text-[10px] uppercase text-slate-500 font-bold">ISA-75.25.01 Deadband Budget</div>
                    <div
                      className={`font-bold ${
                        silPositionerResult.stickSlipRisk === 'HIGH'
                          ? 'text-red-600'
                          : silPositionerResult.stickSlipRisk === 'MODERATE'
                          ? 'text-amber-600'
                          : 'text-emerald-700'
                      }`}
                    >
                      {silPositionerResult.deadbandPctOfTravel}% of Travel ({silPositionerResult.stickSlipRisk} Risk)
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Packing Friction: {actuatorStemResult.balanced.packingFrictionForceC_N} N
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#f8fafc] border border-[#cfd8e3] space-y-1">
                    <div className="text-[10px] uppercase text-slate-500 font-bold">IEC 61508/61511 SIL &amp; Stroking</div>
                    <div className="font-bold text-[#0b2545]">
                      Est. T90: {silPositionerResult.estimatedStrokeTime_s}s {silPositionerResult.pstReady ? `(${targetSilLevel.replace('_', ' ')} PST)` : '(Control)'}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {silPositionerResult.volumeBoosterRecommended
                        ? 'Volume Booster / Quick-Exhaust Recommended'
                        : 'Direct Positioner Air Delivery OK'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Seal/Shutoff Compatibility & FTO/FTC Directional Stability Alerts */}
              <div className="dy-card overflow-hidden">
                <div className="p-4 space-y-2.5 text-xs font-mono">
                  <div
                    className={`rounded-lg p-3 border flex items-start gap-3 ${
                      actuatorStemResult.sealShutoffCompatibilityStatus === 'CRITICAL'
                        ? 'bg-[#ffebee] border-[#ff8a80] text-[#b71c1c]'
                        : actuatorStemResult.sealShutoffCompatibilityStatus === 'WARNING'
                        ? 'bg-[#fff8e1] border-[#ffe082] text-[#e65100]'
                        : 'bg-[#edf7f1] border-[#8be0a8] text-[#0b2545]'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold uppercase">
                          Balance Seal vs. Shutoff Class Compatibility
                        </span>
                        {renderStatusBadge(actuatorStemResult.sealShutoffCompatibilityStatus)}
                      </div>
                      <p className="leading-snug">
                        {actuatorStemResult.sealShutoffCompatibilityNote}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-lg p-3 bg-[#edf1f5] border border-[#cfd8e3] text-[#13315c] flex items-start gap-2.5">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-[#0f8b8d]" />
                    <p className="leading-snug">{actuatorStemResult.flowDirectionStabilityNote}</p>
                  </div>
                </div>
              </div>

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
                      <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between text-[11px]">
                        <span className="text-slate-400">
                          Seating Req ({actuatorStemResult.seatingMarginUnbalancedPct > 0 ? '+' : ''}
                          {actuatorStemResult.seatingMarginUnbalancedPct}%):
                        </span>
                        <span className={actuatorStemResult.seatingMarginUnbalancedPct >= 0 ? 'text-[#8be0a8]' : 'text-[#ff8a80] font-bold'}>
                          {actuatorStemResult.unbalanced.seatingRequiredWithMargin_N.toLocaleString()} N
                        </span>
                      </div>
                      <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between text-[11px]">
                        <span className="text-slate-400">
                          Open-Stroke Req ({actuatorStemResult.openStrokeMarginUnbalancedPct > 0 ? '+' : ''}
                          {actuatorStemResult.openStrokeMarginUnbalancedPct}%):
                        </span>
                        <span className={actuatorStemResult.openStrokeMarginUnbalancedPct >= 0 ? 'text-[#8be0a8]' : 'text-[#ff8a80] font-bold'}>
                          {actuatorStemResult.unbalanced.openingRequiredWithMargin_N.toLocaleString()} N
                        </span>
                      </div>
                      <div className="border-t border-[#2f3b47] pt-2 px-1 flex justify-between font-bold text-sm text-[#ffd77a]">
                        <span>Governing Req (1.25x SF):</span>
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
                      <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between text-[11px]">
                        <span className="text-slate-400">
                          Seating Req ({actuatorStemResult.seatingMarginBalancedPct > 0 ? '+' : ''}
                          {actuatorStemResult.seatingMarginBalancedPct}%):
                        </span>
                        <span className={actuatorStemResult.seatingMarginBalancedPct >= 0 ? 'text-[#8be0a8]' : 'text-[#ff8a80] font-bold'}>
                          {actuatorStemResult.balanced.seatingRequiredWithMargin_N.toLocaleString()} N
                        </span>
                      </div>
                      <div className="instrument-tile rounded px-2.5 py-1.5 flex justify-between text-[11px]">
                        <span className="text-slate-400">
                          Open-Stroke Req ({actuatorStemResult.openStrokeMarginBalancedPct > 0 ? '+' : ''}
                          {actuatorStemResult.openStrokeMarginBalancedPct}%):
                        </span>
                        <span className={actuatorStemResult.openStrokeMarginBalancedPct >= 0 ? 'text-[#8be0a8]' : 'text-[#ff8a80] font-bold'}>
                          {actuatorStemResult.balanced.openingRequiredWithMargin_N.toLocaleString()} N
                        </span>
                      </div>
                      <div className="border-t border-[#2f3b47] pt-2 px-1 flex justify-between font-bold text-sm text-[#7fe0e2]">
                        <span>Governing Req (1.25x SF):</span>
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
                      Operational Stem Diameter &amp; Euler Column Buckling Verification
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
                        Available Thrust (Seat / Open)
                      </span>
                      <span className="text-sm font-bold text-[#7fe0e2]">
                        {actuatorStemResult.availableActuatorSeatingThrust_N.toLocaleString()} N
                      </span>
                      <span className="block text-[10px] text-[#8be0a8]">
                        Open-Stroke: {actuatorStemResult.availableActuatorOpenThrust_N.toLocaleString()} N
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

              <div className="px-5 py-2.5 bg-[#0f8b8d]/10 border-b border-[#0f8b8d]/30 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-[#0b2545]">
                <span>
                  <strong>Active Workbench Size:</strong>{' '}
                  <span className="text-[#0f8b8d] font-bold">
                    DN{selectedDN} ({GENERIC_VALVE_SCHEDULE.find((s) => s.dn === selectedDN)?.npsLabel})
                  </span>{' '}
                  — Clicking any schedule row below updates Tabs 1–5 globally (Size, Bore, Stroke, Cage &amp; Stem).
                </span>
                <span className="text-[11px] font-semibold text-[#13315c]">
                  Rated: {correlatedValve.ratedCv} Cv • Bore Ø{correlatedValve.d_port_mm} mm • Stroke {correlatedValve.stroke_mm} mm
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

      {/* ISA-20 / IEC 60534 PRINTABLE ENGINEERING DATASHEET (VISIBLE ONLY ON PRINT) */}
      <section className="hidden print:block bg-white text-black p-6 font-mono text-[11px] space-y-5">
        <div className="border-b-2 border-[#0b2545] pb-3 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-base font-bold text-[#0b2545]">
              DY-SIZE // CONTROL VALVE &amp; DRILLED CAGE ENGINEERING DATASHEET
            </h1>
            <p className="text-[10px] text-slate-600">
              Software Rev {APP_VERSION} • IEC 60534-2-1 / 60534-8-3 • ISA-75 / ISA-20 • ASME B16.34 / Sec VIII Div. 1
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[10px] text-right">
            <span>
              <strong>Tag No.:</strong> {projectMeta.tagNumber}
            </span>
            <span>
              <strong>Rev:</strong> {projectMeta.projectRev}
            </span>
            <span>
              <strong>Line / P&amp;ID:</strong> {projectMeta.lineNumber}
            </span>
            <span>
              <strong>Date:</strong> {new Date().toISOString().slice(0, 10)}
            </span>
          </div>
        </div>

        <div className="border border-slate-400 px-3 py-1.5 text-[11px]">
          <strong>Service Description:</strong> {projectMeta.serviceDescription}
        </div>

        {/* SECTION A: MULTI-CONDITION PROCESS SIZING & ACOUSTICS */}
        <div className="space-y-1.5">
          <h2 className="text-xs font-bold uppercase bg-slate-200 px-2 py-1 border border-slate-400">
            Section A — Multi-Condition Process Operating Cases, Cavitation &amp; Noise (IEC 60534)
          </h2>
          <table className="w-full border-collapse border border-slate-400 text-[10px]">
            <thead>
              <tr className="bg-slate-100">
                <th className="border border-slate-400 px-2 py-1 text-left">Case</th>
                <th className="border border-slate-400 px-2 py-1 text-left">Phase</th>
                <th className="border border-slate-400 px-2 py-1 text-right">
                  Flow ({processUnits.flowRate})
                </th>
                <th className="border border-slate-400 px-2 py-1 text-right">
                  P1 / P2* ({processUnits.P1})
                </th>
                <th className="border border-slate-400 px-2 py-1 text-right">
                  T1 ({processUnits.T1})
                </th>
                <th className="border border-slate-400 px-2 py-1 text-right">Req Cv (Kv)</th>
                <th className="border border-slate-400 px-2 py-1 text-right">% Open</th>
                <th className="border border-slate-400 px-2 py-1 text-right">Noise (Std→Cage)</th>
                <th className="border border-slate-400 px-2 py-1 text-left">Regime / Status</th>
              </tr>
            </thead>
            <tbody>
              {caseResults.map((r) => {
                const effCase = effectiveOperatingCases.find((c) => c.id === r.id);
                const dispFlow = effCase
                  ? Number(fromInternalFlow(effCase.flowRate, processUnits.flowRate, effCase.fluidPhase).toFixed(2))
                  : 0;
                const dispP1 = effCase
                  ? Number(fromInternalPressure(effCase.P1_bar_a, processUnits.P1).toFixed(2))
                  : 0;
                const dispP2 = effCase
                  ? Number(fromInternalPressure(effCase.P2_bar_a, processUnits.P1).toFixed(2))
                  : 0;
                const dispT1 = effCase
                  ? Number(fromInternalTemperature(effCase.T1_degC, processUnits.T1).toFixed(1))
                  : 0;
                return (
                  <tr key={r.id}>
                    <td className="border border-slate-400 px-2 py-1 font-bold">{r.label}</td>
                    <td className="border border-slate-400 px-2 py-1">{r.fluidPhase}</td>
                    <td className="border border-slate-400 px-2 py-1 text-right">{dispFlow}</td>
                    <td className="border border-slate-400 px-2 py-1 text-right">
                      {dispP1} / {dispP2}
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right">{dispT1}</td>
                    <td className="border border-slate-400 px-2 py-1 text-right font-bold">
                      {r.requiredCv} ({r.requiredKv})
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right">
                      {r.estimatedTravelPct}%
                    </td>
                    <td className="border border-slate-400 px-2 py-1 text-right">
                      {r.noiseStandardTrim_dBA}→{r.noiseDrilledCage_dBA} dBA
                    </td>
                    <td className="border border-slate-400 px-2 py-1">
                      [{r.regimeSeverity}] {r.regimeLabel}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {enableBackpressureOrifice && backpressureOrificeResult && (
            <p className="text-[10px]">
              <strong>Backpressure Orifice Coupled:</strong> Orifice Cv = {backpressureOrificeResult.orificeRatedCv} | Equiv Bore Ø
              {backpressureOrificeResult.equivalentOrificeBore_mm} mm | Governing ΔP ={' '}
              {backpressureOrificeResult.orificeDeltaPAtMax_bar} bar ({backpressureOrificeResult.designMaxCaseLabel})
            </p>
          )}
        </div>

        {/* SECTION B: HARDWARE CORRELATION, PIPING & CHARACTERISTIC */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <h2 className="text-xs font-bold uppercase bg-slate-200 px-2 py-1 border border-slate-400">
              Section B — Valve Body, Piping &amp; Characteristic
            </h2>
            <table className="w-full border-collapse border border-slate-400 text-[10px]">
              <tbody>
                <tr>
                  <td className="border border-slate-400 px-2 py-1 font-bold">Nominal Size / Rating</td>
                  <td className="border border-slate-400 px-2 py-1">
                    DN{selectedDN} ({GENERIC_VALVE_SCHEDULE.find((s) => s.dn === selectedDN)?.npsLabel}) /{' '}
                    {PRESSURE_CLASSES[pressureClass].label}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 px-2 py-1 font-bold">Body / Trim / Flow</td>
                  <td className="border border-slate-400 px-2 py-1">
                    {bodyStyle} / {TRIM_STYLES[trimStyle].shortName} / {flowDirection}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 px-2 py-1 font-bold">Rated Capacity / Bore / Stroke</td>
                  <td className="border border-slate-400 px-2 py-1">
                    {correlatedValve.ratedCv} Cv ({correlatedValve.ratedKv} Kv) | Ø{correlatedValve.d_port_mm} mm | {correlatedValve.stroke_mm} mm
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 px-2 py-1 font-bold">FL / Kc / xT / Fd</td>
                  <td className="border border-slate-400 px-2 py-1">
                    {correlatedValve.FL} / {correlatedValve.Kc} / {correlatedValve.xT} / {cageSynthesis.styleModifierFd}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 px-2 py-1 font-bold">Piping (D1 / D2 / Wall)</td>
                  <td className="border border-slate-400 px-2 py-1">
                    {piping.upstreamPipeID_mm} / {piping.downstreamPipeID_mm} mm (t={piping.pipeWallThickness_mm} mm) • {piping.bodyMaterialCategory}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 px-2 py-1 font-bold">Characteristic &amp; Authority</td>
                  <td className="border border-slate-400 px-2 py-1">
                    {effectiveCharConfig.type} (Pv={effectiveCharConfig.valveAuthorityPv.toFixed(2)}) • EnTec Band {charSimulation.stabilityBandCoveragePct}% • Ratio {charSimulation.gainRatioWorkingSpan}:1
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 px-2 py-1 font-bold">Body Mat. &amp; ASME B16.34</td>
                  <td className="border border-slate-400 px-2 py-1">
                    {BODY_MATERIAL_GROUPS[bodyMaterial].astmSpec} ({asmeB1634Result.designPressureBarG} / {asmeB1634Result.maxAllowableBarG} bar g @ {asmeB1634Result.designTempDegC}°C) [{asmeB1634Result.isCompliant ? 'PASS' : 'FAIL'}]
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 px-2 py-1 font-bold">End Conn. / F2F (ISA-75.08)</td>
                  <td className="border border-slate-400 px-2 py-1">
                    {pipingBodyStandards.endConnectionLabel} | F2F: {pipingBodyStandards.faceToFace_mm} mm | Run: {pipingBodyStandards.minUpstreamStraightRun_mm}/{pipingBodyStandards.minDownstreamStraightRun_mm} mm
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 px-2 py-1 font-bold">Emissions / Fire / SIL</td>
                  <td className="border border-slate-400 px-2 py-1">
                    ISO 15848 Class {fugitiveEmissionsSpec.iso15848TightnessClass} | API 607: {fireSafeRequired ? (pipingBodyStandards.fireSafeCompliant ? 'COMPLIANT' : 'NON-COMPLIANT') : 'N/A'} | {silServiceEnabled ? `${targetSilLevel.replace('_', ' ')} (T90=${silPositionerResult.estimatedStrokeTime_s}s)` : 'Control'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* SECTION C: DRILLED CAGE & ASME STRUCTURAL */}
          <div className="space-y-1">
            <h2 className="text-xs font-bold uppercase bg-slate-200 px-2 py-1 border border-slate-400">
              Section C — Drilled Cage Synthesis &amp; ASME Stress
            </h2>
            <table className="w-full border-collapse border border-slate-400 text-[10px]">
              <tbody>
                <tr>
                  <td className="border border-slate-400 px-2 py-1 font-bold">Cage Material / NACE</td>
                  <td className="border border-slate-400 px-2 py-1">
                    {CAGE_MATERIALS[cageMaterial].name} | NACE MR0175: {requireNaceSourService ? 'YES' : 'NO'}
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 px-2 py-1 font-bold">Perforations / Drills</td>
                  <td className="border border-slate-400 px-2 py-1">
                    {cageSynthesis.totalHoles} holes across {cageSynthesis.rows.length} rows | Drills: {cageSynthesis.distinctDrillSizes_mm.map((d) => `Ø${d}`).join(', ')} mm
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 px-2 py-1 font-bold">Drill Aspect Ratio</td>
                  <td className="border border-slate-400 px-2 py-1">
                    {cageSynthesis.maxDrillAspectRatio}x [{cageSynthesis.drillManufacturabilityStatus}]
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 px-2 py-1 font-bold">Min Ligament / Efficiency</td>
                  <td className="border border-slate-400 px-2 py-1">
                    w_min={cageSynthesis.minLigamentWidth_mm} mm (η={(cageSynthesis.minLigamentEfficiency * 100).toFixed(1)}%)
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 px-2 py-1 font-bold">Cage Wall / Hoop Stress</td>
                  <td className="border border-slate-400 px-2 py-1">
                    t={cageSynthesis.selectedWallThickness_mm} mm (min {cageSynthesis.minRequiredWallThickness_mm} mm) | σ={cageSynthesis.hoopStress_MPa}/{cageSynthesis.allowableStressSm_MPa} MPa [{cageSynthesis.structuralStatus}]
                  </td>
                </tr>
                <tr>
                  <td className="border border-slate-400 px-2 py-1 font-bold">Continuity / Deadband</td>
                  <td className="border border-slate-400 px-2 py-1">
                    Deadband {cageSynthesis.deadbandStrokePct}% (Mean overlap {cageSynthesis.meanRowOverlapPct}%)
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* SECTION D: TRANSIENT THERMAL, ACTUATOR & STEM SIZING */}
        <div className="space-y-1">
          <h2 className="text-xs font-bold uppercase bg-slate-200 px-2 py-1 border border-slate-400">
            Section D — Thermal Binding, Anti-Galling, Bonnet &amp; Actuator / Stem Verification
          </h2>
          <table className="w-full border-collapse border border-slate-400 text-[10px]">
            <tbody>
              <tr>
                <td className="border border-slate-400 px-2 py-1 font-bold w-1/4">Trim/Body Alloys</td>
                <td className="border border-slate-400 px-2 py-1 w-1/4">
                  Plug: {THERMAL_ALLOYS[plugAlloy].name} | Cage: {THERMAL_ALLOYS[cageAlloy].name} | Body: {THERMAL_ALLOYS[bodyAlloy].name}
                </td>
                <td className="border border-slate-400 px-2 py-1 font-bold w-1/4">Shutoff / Flow / Seal</td>
                <td className="border border-slate-400 px-2 py-1 w-1/4">
                  {shutoffClass} | {flowDirection} | {balanceSealType} [{actuatorStemResult.sealShutoffCompatibilityStatus}]
                </td>
              </tr>
              <tr>
                <td className="border border-slate-400 px-2 py-1 font-bold">Transient Clearance &amp; Risks</td>
                <td className="border border-slate-400 px-2 py-1">
                  Min c_rad={thermalResult.minTransientRadialClearance_mm} mm (Floor {thermalResult.minSafeRadialClearanceFloor_mm} mm @ {effectiveThermalTargetTemp_degC}°C) | Radial [{thermalResult.radialBindingRisk}], Galling [{thermalResult.gallingRisk}]
                </td>
                <td className="border border-slate-400 px-2 py-1 font-bold">Actuator Thrust Margins</td>
                <td className="border border-slate-400 px-2 py-1">
                  ΔP_shutoff={effectiveShutoffDeltaP_bar} bar | Unbal: {actuatorStemResult.actuatorMarginUnbalancedPct}% | Bal: {actuatorStemResult.actuatorMarginBalancedPct}% (Seat {actuatorStemResult.seatingMarginBalancedPct}% / Open {actuatorStemResult.openStrokeMarginBalancedPct}%)
                </td>
              </tr>
              <tr>
                <td className="border border-slate-400 px-2 py-1 font-bold">Bonnet &amp; Packing Advisor</td>
                <td className="border border-slate-400 px-2 py-1">
                  {thermalResult.bonnetAdvisor.bonnetTitle} | {thermalResult.bonnetAdvisor.recommendedPackingSystem} (Box ~{thermalResult.bonnetAdvisor.estimatedPackingBoxTemp_degC}°C)
                </td>
                <td className="border border-slate-400 px-2 py-1 font-bold">Stem &amp; Column Buckling</td>
                <td className="border border-slate-400 px-2 py-1">
                  {STEM_MATERIALS[stemMaterial].name} Ø{selectedStemDia_mm} mm (L={unsupportedStemLength_mm} mm) | SF={actuatorStemResult.bucklingSafetyFactor}x [{actuatorStemResult.stemStructuralStatus}]
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
