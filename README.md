# RBR Setup Compare

Compare Richard Burns Rally setup files side by side.

**[Live App](https://pohy.github.io/rbr-setup-compare/)**

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
