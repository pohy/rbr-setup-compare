# RBR Setup Compare

Compare Richard Burns Rally setup files side by side.

## [https://pohy.github.io/rbr-setup-compare](https://pohy.github.io/rbr-setup-compare)

[preview.webm](https://github.com/user-attachments/assets/025880d4-5bfe-48c0-b8f5-9a29e349ef40)

## Features

- **Drag-and-drop import** — load `.lsp` setup files by dropping them onto the app or using a file picker
- **RBR directory browsing** — point the app at your RBR installation to browse and select setups from `rsfdata/`, `Physics/`, and `SavedGames/` directories, with cross-location deduplication (uses File System Access API, remembered across sessions)
- **Side-by-side comparison** — view multiple setups in a single table, organized by section (Suspension, Engine, Tyres, etc.)
- **Difference highlighting** — individual cells that differ from the reference setup are highlighted, with numeric deltas shown as color-coded +/- values
- **Front/rear split ratios** — paired Front/Rear parameters are grouped together with the split ratio (e.g. 72:28) overlaid between them
- **Diffs-only mode** — toggle to hide matching parameters and focus on what's different
- **Units and formatting** — values are displayed with appropriate units (mm, kN/m, kPa, etc.) and consistent decimal precision
- **Sticky headers and columns** — parameter names and setup columns stay visible while scrolling
- **Collapsible sections** — expand or collapse setup sections individually
- **Drag-to-reorder** — rearrange setup columns by dragging
- **Setup editing** — click a cell to type a new value, or click-and-drag to adjust incrementally (hold Shift for fine 1/10th steps); values are clamped to valid ranges when car metadata is available
- **Edit diff modes** — compare edits against the original setup or against the reference column
- **Save edited setups** — download as `.lsp`, overwrite the original file in your RBR directory, or rename and save alongside it
- **Setup management** — add, remove individual setups, or clear all at once
- **Shareable links** — copy a URL that encodes the current comparison, so others can open it without needing the original files

## Credits

- [pmfrlyn/RBRTools](https://github.com/pmfrlyn/RBRTools) — Python parser used as reference for the `.lsp` file format and parsing logic
- [pshires/RbrSetupCompare](https://github.com/pshires/RbrSetupCompare) — Ruby app used as reference for unit conversions and value sanitization
- [RBR Setup Studio](https://rbr-setup-studio.web.app/) — UI/UX reference for setup value display
- [RallySimFans](https://rallysimfans.hu) — community platform whose directory structure conventions (`rsfdata/`, car naming, RSF IDs) the app supports
- [NGP6 physics plugin](https://rallysimfans.hu) — defines the modern `.lsp` format variant and `_NGP` parameters
