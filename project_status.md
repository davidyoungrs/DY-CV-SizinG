# DY SIZE — Control Valve Sizing & Drilled Cage CAE Workbench
## Project Status & Handover Reference (`project_status.md`)

**Last Updated:** 2026-11-13  
**Workspace Path:** `/Volumes/Untitled/DY Size - Control Valve Sizing`  
**Build / Dev Mirror Path:** `/tmp/dy-size-build` (used for `node_modules` & Vite dev server on `http://localhost:5173/`)  
**NotebookLM Technical Reference:** `valve-handbook` (ID: `2118d92e-13eb-49a2-bd50-39d076af3f3b`)

---

## 1. Executive Summary & Current Status
- **Status:** **v1.0 Complete, Built & Verified (`tsc -b && vite build` passing with 0 errors).**
- **Core Workflow Implemented:**
  1. **Starts at the top with Multi-Condition Process Sizing (Tab 1):** Evaluates all operating conditions (Min, Normal, Max, Start-Up/Upset) for Liquid, Gas, or Steam using IEC 60534-2-1 & 60534-8-3/8-4.
  2. **Accommodates All Conditions in One Valve:** Automatically recommends a single manufacturer-agnostic standard valve size (`DN15`–`DN600` / `1/2"`–`24"`) and pressure rating (`ASME Class 150–2500 / PN16–PN420`), defaulting on a **Linear** characteristic (`CONTOURED_LINEAR` / `LINEAR`).
  3. **Back-Calculates Operating % Open & Acoustic Noise (`dBA`):** Uses the selected valve's maximum rated $C_v$ to back-calculate the exact percentage of rated $C_v$, travel `% open`, cavitation/choked flow regime, and aerodynamic/hydrodynamic noise (`dBA`, standard trim vs. multi-hole drilled cage with Strouhal ultrasonic frequency shift) for every operating condition.
  4. **Zero-Deadband Overlapping Staggered Drilled Cage Synthesis (Tab 3):** Eliminates axial deadband ($dA/dh = 0$) between rows by placing Row 1 tangent to the seat ($z_{\text{bottom},1} = 0.0\text{ mm}$) and enforcing vertical row overlap ($p_{z,k} \le (1 - \lambda_{\text{overlap}})\bar{d}_k$, default `28%` overlap) across staggered rows, verified with an exact continuous circular-segment uncovering solver (`Deadband: 0.0%`).
  5. **Ngqabutho Sibanda (2022) PhD Thesis Models Integrated:**
     - **Chapter 5 Semi-Empirical 3D Gallery Local Hole $C_v(\theta, z)$ Correlation (Eq. 5.10):** Models circumferential and axial flow non-uniformity around the 360° cage gallery ($0^\circ / 360^\circ$ inlet stagnation peak, $135^\circ \text{ & } 225^\circ$ flank boundary-layer separation/cavitation risk troughs, $180^\circ$ rear collision recovery, and $HT^{0.15013}$ row elevation gain).
     - **Chapter 6 Least-Cost Life-Cycle Valve Diameter Optimization:** Computes manufacturing cost ($C_{\text{Mfg}} = M_1 + A_1 + P_1$) plus 10-year pumping head-loss operating energy cost ($C_{\text{Op}}$) across all candidate DN sizes.

---

## 2. Codebase Architecture & Module Map

### Core Engineering Engines (`src/engine/`)
| File | Responsibility |
| :--- | :--- |
| [`src/engine/valveSchedule.ts`](./src/engine/valveSchedule.ts) | Manufacturer-agnostic Master Valve Schedule (`DN15` to `DN600`, `CL150` to `CL2500`), geometric correlations ($d_{\text{port}}/D$, stroke $H$, $C_v/d_{\text{port}}^2$, $F_L, x_T, K_c, F_d$), and composite series hydraulic capacity ($C_{v,\text{rated}}^{-2} = C_{v,\text{trim}}^{-2} + C_{v,\text{seat}}^{-2} + C_{v,\text{body}}^{-2}$). |
| [`src/engine/iec60534Sizing.ts`](./src/engine/iec60534Sizing.ts) | Multi-condition IEC 60534-2-1 sizing (liquid, gas, steam), swaged reducer/expander piping factors ($F_P, F_{LP}, x_{TP}$), non-turbulent viscosity correction ($Re_v, F_R$), 5-tier cavitation/flashing regime classifier ($\sigma, K_c, x_{FZ}$), Joukowsky water-hammer surge check, and IEC 60534-8-3/8-4 acoustic noise (`dBA`) with Strouhal peak frequency shift ($f_p \text{ vs. } f_r$). |
| [`src/engine/valveRecommender.ts`](./src/engine/valveRecommender.ts) | Automated single-valve size (`DN`) & pressure rating (`ASME/PN`) recommender across all active process conditions (defaulting on Linear characteristic), plus **Sibanda (2022) Chapter 6 Least-Cost Life-Cycle Optimization** ($C_{\text{Total}}(D) = C_{\text{Mfg}}(D) + C_{\text{Op}}(D)$). |
| [`src/engine/characteristicEngine.ts`](./src/engine/characteristicEngine.ts) | Inherent & custom trim characteristics (`LINEAR`, `EQUAL_PCT`, `MODIFIED_EQUAL_PCT`, `BI_LINEAR`, `QUICK_OPENING`, `MODIFIED_PARABOLIC`, `CUSTOM_SPLINE`, `AUTO_FIT_CONSTANT_GAIN`), Valve Authority ($P_v$) installed flow distortion, and EnTec $[0.5, 2.0]$ installed loop gain ($G_{\text{installed}}$) stability analysis. |
| [`src/engine/cageSynthesisAndStress.ts`](./src/engine/cageSynthesisAndStress.ts) | Zero-deadband overlapping staggered row synthesizer, exact circular-segment uncovering physics ($A_{\text{seg}}(h)$ and chord gain $dA/dh$), **Sibanda (2022) Eq. 5.10 3D gallery local hole $C_v(\theta, z)$ predictor**, ASME B16.34 / Sec VIII Div. 1 perforated ligament hoop stress & buckling collapse solver, AutoCAD `.DXF` generator, and 4-axis CNC `G83` G-code generator. |
| [`src/engine/transientThermalEngine.ts`](./src/engine/transientThermalEngine.ts) | Lumped-capacitance transient thermal expansion solver ($T_{\text{plug}}(t), T_{\text{cage}}(t), T_{\text{body}}(t)$), dynamic radial guide clearance pinch-point ($c_{\text{radial}}(t)$), axial stack crush, and Bonnet/Packing Thermal Isolation Advisor (`-196°C` to `+580°C`). |
| [`src/engine/actuatorAndStemEngine.ts`](./src/engine/actuatorAndStemEngine.ts) | Balanced vs. Unbalanced force balance ($F_{\text{total}} = A + B + C + D$), ANSI/FCI 70-2 Classes II–VI seat load, pneumatic diaphragm bench-set margin check, and ASME/Euler stem diameter & buckling verifier. |

### Application UI & Configuration
- [`src/App.tsx`](./src/App.tsx): 6-Tab Dark-Slate CAE Workbench (`#0f172a` / `#1e293b` / `#06b6d4` / `#10b981` / `#f59e0b` / `#ef4444` styling matched to the reference dashboards):
  - **Tab 1 (`PROCESS_SIZING`):** Automated Single-Valve Recommendation Card + Sibanda Life-Cycle Cost summary, Fluid Benchmark Presets, Swaged Piping Envelope, Multi-Condition Input Table, and IEC 60534 Sizing & Acoustic Noise Diagnostic Matrix.
  - **Tab 2 (`CHARACTERISTICS`):** Inherent & Custom PCHIP Spline Trim Builder, Valve Authority ($P_v$) slider, Inherent vs. Installed Flow SVG chart, and Installed Gain ($G_{\text{installed}}$) stability envelope chart.
  - **Tab 3 (`CAGE_CAD_STRESS`):** Zero-Deadband Row Overlap controls (`enforceZeroDeadbandOverlap`, `targetRowOverlapPct`), ASME Hoop Stress & Ligament verifier, Interactive 2D Unrolled Cage CAD Blueprint with Live Plug Lift curtain & Sibanda 360° Gallery Heatmap, Continuous Circular-Segment $C_v(h)$ & $dA/dh$ chart, Sibanda Circumferential $C_v(\theta)$ chart, Row Schedule Table, and 4-Axis CNC G-Code preview.
  - **Tab 4 (`TRANSIENT_THERMAL`):** Transient Thermal Differential Expansion simulator, Radial Clearance Pinch-Point chart, and Bonnet/Packing Advisor.
  - **Tab 5 (`ACTUATOR_STEM`):** Actuator Thrust ($A+B+C+D$), Pneumatic Bench Set verification, and Stem Diameter / Euler Buckling sizing.
  - **Tab 6 (`MASTER_SCHEDULE`):** Manufacturer-Agnostic Master Valve Correlation Schedule (`DN15`–`DN600`).
- [`vercel.json`](./vercel.json), [`package.json`](./package.json), [`vite.config.ts`](./vite.config.ts), [`tailwind.config.js`](./tailwind.config.js): Configured for zero-config static SPA deployment on Vercel (`dist` output).

---

## 3. NotebookLM Technical Reference (`valve-handbook`)
- **Notebook ID:** `2118d92e-13eb-49a2-bd50-39d076af3f3b`
- **Indexed Reference Documents:**
  - *Industrial Control Valve Handbook & Technical Reference* (IEC 60534 / ISA-75 equations, $F_L, x_T, K_c$)
  - *Emerson Fisher Control Valve Handbook (5th Ed.)*
  - *Philip L. Skousen — Valve Handbook (3rd Ed.)*
  - *Severn Glocon 5000, 4000, and 1200 Series Control Valve Technical Brochures*
  - *IMI CCI 840 / 860 Heavy-Duty Control Valve Brochure*
  - *Ngqabutho Sibanda (2022) PhD Thesis — "Multi-Stage and Multi-Trim-Type Control Valve Sizing and Optimization" (University of Huddersfield, `FINAL_THESIS.pdf`, Source ID: `f7ae71a0-be62-42be-931e-f0530c077d24`)*

---

## 4. How to Run, Build & Resume Development

### Important Note on Disk Space (`/Volumes/Untitled`)
Because `/Volumes/Untitled` is formatted with an ExFAT filesystem (128 KB minimum cluster allocation unit), storing `node_modules` directly on `/Volumes/Untitled` consumes ~700 MB of disk blocks. To keep `/Volumes/Untitled` clean with >700 MB free space:
- Source files (`src/`, `package.json`, `vercel.json`, `dist/`, etc.) live in `/Volumes/Untitled/DY Size - Control Valve Sizing`.
- `node_modules` is installed in `/tmp/dy-size-build` on the internal drive.

### Quick Commands When Resuming
1. **If `/tmp/dy-size-build` was cleared after a macOS reboot, recreate it in one step:**
   ```bash
   mkdir -p /tmp/dy-size-build && cp -R "/Volumes/Untitled/DY Size - Control Valve Sizing/"* /tmp/dy-size-build/ && npm install --prefix /tmp/dy-size-build
   ```
2. **Sync changes from workspace to `/tmp/dy-size-build` and run production build:**
   ```bash
   cp -R "/Volumes/Untitled/DY Size - Control Valve Sizing/src/"* /tmp/dy-size-build/src/ && npm run build --prefix /tmp/dy-size-build && cp -R /tmp/dy-size-build/dist "/Volumes/Untitled/DY Size - Control Valve Sizing/"
   ```
3. **Start the local development server (`http://localhost:5173/`):**
   ```bash
   cd /tmp/dy-size-build && npx vite --host 0.0.0.0 --port 5173
   ```

---

## 5. Potential Next Steps / Future Enhancements
- **Multi-Stage Concentric Sleeve / Labyrinth Stack Builder:** Extend Tab 3 to synthesize 2-stage and 3-stage concentric drilled sleeves with expanding stage area ratios ($A_1 : A_2 : A_3$) for extreme liquid pressure drops ($\Delta P > 100\text{ bar}$) and gas letdown.
- **Per-Sector Asymmetric Circumferential Drilling Compensation:** Option in Tab 3 to automatically vary hole count or diameter by gallery sector ($\theta \in [0^\circ, 360^\circ]$) using Sibanda's Eq. 5.10 inverse weights so that local mass flux is uniform around the circumference.
- **Vercel Cloud Deployment:** Connect the repository or run `npx vercel --prod` from `/Volumes/Untitled/DY Size - Control Valve Sizing` to publish the live web URL.
