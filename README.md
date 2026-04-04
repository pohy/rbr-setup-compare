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

## MCP Server (LLM Setup Tuning)

An MCP server exposes setup reading, comparison, and editing as tools callable by LLMs (e.g. via Claude Code). This lets you ask an LLM to tune your car setups conversationally.

### Setup

Add to your Claude Code MCP settings (project or global):

```json
{
  "mcpServers": {
    "rbrtune": {
      "command": "pnpm",
      "args": ["tsx", "src/mcp/main.ts"],
      "cwd": "/path/to/rbr-setup-compare"
    }
  }
}
```

On first use, call the `set_rbr_directory` tool with your RBR install path. This is persisted across sessions.

### Available Tools

| Tool | Description |
|------|-------------|
| `set_rbr_directory` | Configure the RBR install path |
| `list_cars` | List cars, setups, surfaces, and MCP-managed status |
| `read_setup` | Read a setup with labels, units, and display values |
| `read_ranges` | Get valid min/max/step ranges for a car + surface |
| `compare_setups` | Diff two or more setups side by side |
| `propose_change` | Preview changes (absolute or relative %) with range clamping |
| `apply_changes` | Write validated changes to disk as MCP-managed files |

### Safety

- **Copy-on-write**: original setup files are never overwritten. New files get a `; mcp-managed` header comment (invisible to the game).
- **MCP-managed files** can be overwritten in subsequent edits. Non-managed files always create a new copy.
- **Range clamping**: all values are validated against the car's range files. Out-of-range values are clamped.
- **Symmetric editing**: only left-side sections are accepted; right-side is mirrored automatically.
- **Writes target `SavedGames/`** only.

### Logs

Debug logs are written to `rbr-tuner.log` in the project root.

## Credits

- [pmfrlyn/RBRTools](https://github.com/pmfrlyn/RBRTools) — Python parser used as reference for the `.lsp` file format and parsing logic
- [pshires/RbrSetupCompare](https://github.com/pshires/RbrSetupCompare) — Ruby app used as reference for unit conversions and value sanitization
- [RBR Setup Studio](https://rbr-setup-studio.web.app/) — UI/UX reference for setup value display
- [RallySimFans](https://rallysimfans.hu) — community platform whose directory structure conventions (`rsfdata/`, car naming, RSF IDs) the app supports
- [NGP7 physics plugin](https://rallysimfans.hu) — defines the modern `.lsp` format variant and `_NGP` parameters
