# RBR Setup Compare

Compare Richard Burns Rally setup files side by side.

## [https://pohy.github.io/rbr-setup-compare](https://pohy.github.io/rbr-setup-compare)

[preview.webm](https://github.com/user-attachments/assets/025880d4-5bfe-48c0-b8f5-9a29e349ef40)

## Features

- **Import** — drag-and-drop or file picker; manually loaded setups persist across refresh
- **RBR directory** — browse `rsfdata/`, `Physics/`, and `SavedGames/` with cross-location deduplication; external file changes auto-detected (File System Access API, remembered across sessions)
- **Filter** — search the browser by car or file name
- **Comparison table** — side-by-side columns grouped by section, with sticky headers/columns, collapsible sections, and drag-to-reorder
- **Diff highlighting** — differing cells highlighted with color-coded +/- deltas; paired Front/Rear rows show split ratio (e.g. 72:28); diffs-only toggle hides matching rows
- **Labels & units** — in-game labels (toggle to raw `.lsp` keys); values in mm, kN/m, kPa, %, etc. with consistent precision
- **Editing** — click cell to type, drag to adjust, or click left/right zones to step by field increment (Shift = 1/10 step); values clamped to the car's range with live range-fill background; L/R edits mirror to paired side; per-cell reset; non-editable fields hidden
- **Edit diff modes** — compare edits against original or a chosen reference column (hover toggle to see target)
- **Save** — download `.lsp`, overwrite original (with confirmation), rename-and-save, or save as new into `SavedGames/`; defaults protected; in-progress edits persist across refresh
- **Setup management** — add, remove, or clear all; confirms before discarding edits
- **Shareable links** — URL encodes the comparison; opens in a separate view with an opt-in toggle to import into "My Setups"

## Credits

- [pmfrlyn/RBRTools](https://github.com/pmfrlyn/RBRTools)
- [pshires/RbrSetupCompare](https://github.com/pshires/RbrSetupCompare)
- [RBR Setup Studio](https://rbr-setup-studio.web.app/)
- [RallySimFans](https://rallysimfans.hu)
- [NGP6 physics plugin](https://rallysimfans.hu)
