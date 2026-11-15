# Project Reference Configuration: Control Valve Sizing

## Technical Reference Notebook (NotebookLM)
- **Title:** Industrial Control Valve Handbook and Technical Reference
- **Notebook ID:** `2118d92e-13eb-49a2-bd50-39d076af3f3b`
- **Alias:** `valve-handbook`

### Usage
When looking up control valve equations (IEC 60534 / ISA-75), sizing calculations, cavitation index ($F_L, x_T, K_c$), characteristic curves, flow coefficients ($C_v / K_v$), or mechanical/fluid reference data, consult this notebook using the NotebookLM MCP tools (`notebook_query` with notebook ID `2118d92e-13eb-49a2-bd50-39d076af3f3b` or alias `valve-handbook`) or `nlm query notebook valve-handbook "<question>"`.

## Version & Revision Tracking
- **Current Version:** `1.0.4` (next push/change -> `1.0.5`)
- **Locations to keep synchronized on every change:**
  1. `APP_VERSION` in `src/App.tsx` (rendered in the sticky title bar `Rev {APP_VERSION}`, `document.title`, and printable datasheet header)
  2. `<title>` in `index.html`
  3. `"version"` in `package.json`
- **Increment Rule:** Increment the patch number by `+0.0.1` (`1.0.4` -> `1.0.5` -> `1.0.6`, etc.) with every code change/push. Escalate to `1.1`, `2.0`, etc. only when explicitly instructed by the user.
