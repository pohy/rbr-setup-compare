# RBR Setup Compare

Compare Richard Burns Rally setup files side by side.

## [https://pohy.github.io/rbr-setup-compare](https://pohy.github.io/rbr-setup-compare)

[preview.webm](https://github.com/user-attachments/assets/025880d4-5bfe-48c0-b8f5-9a29e349ef40)

## Features

- **Drag-and-drop import** — load `.lsp` setup files by dropping them onto the app or using a file picker
- **RBR directory browsing** — point the app at your RBR installation to browse and select setups from `rsfdata/` and `Physics/` directories (uses File System Access API, remembered across sessions)
- **Side-by-side comparison** — view multiple setups in a single table, organized by section (Suspension, Engine, Tyres, etc.)
- **Difference highlighting** — rows with differing values are highlighted, with numeric deltas shown as color-coded +/- values relative to the first setup
- **Diffs-only mode** — toggle to hide matching parameters and focus on what's different
- **Units and formatting** — values are displayed with appropriate units (mm, kN/m, kPa, etc.) and consistent decimal precision
- **Sticky headers and columns** — parameter names and setup columns stay visible while scrolling
- **Collapsible sections** — expand or collapse setup sections individually
- **Drag-to-reorder** — rearrange setup columns by dragging
- **Setup management** — add, remove individual setups, or clear all at once

## Credits

- [pmfrlyn/RBRTools](https://github.com/pmfrlyn/RBRTools) — Python parser used as reference for the `.lsp` file format and parsing logic
- [pshires/RbrSetupCompare](https://github.com/pshires/RbrSetupCompare) — Ruby app used as reference for unit conversions and value sanitization
- [RBR Setup Studio](https://rbr-setup-studio.web.app/) — UI/UX reference for setup value display
- [RallySimFans](https://rallysimfans.hu) — community platform whose directory structure conventions (`rsfdata/`, car naming, RSF IDs) the app supports
- [NGP6 physics plugin](https://rallysimfans.hu) — defines the modern `.lsp` format variant and `_NGP` parameters
