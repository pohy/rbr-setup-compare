# RBR Directory Structure

Reference for the Richard Burns Rally directory layout, focused on setup files and car physics. Based on an RSF (RallySimFans) installation with the NGP6 physics plugin.

## Top-Level Layout

```
Richard Burns Rally/
├── Cars/                  # 3D car models and visual config
├── Physics/               # Vanilla physics for the 8 original cars
├── Plugins/               # NGP, OpenRBRVR, RBRHUD, etc.
├── SavedGames/            # Active setups loaded by the game
├── rsfdata/               # RSF-managed content (NGP cars, user setups)
├── RichardBurnsRally.exe
└── ...
```

## Setup File Locations

Setups live in three places. The app scans all three when you open an RBR directory.

### 1. `rsfdata/cars/{CarName}/setups/` — Default setups

Ship with each NGP car physics package. One directory per car.

```
rsfdata/cars/Skoda_Fabia_S2000_Evo_2_ngp6/setups/
├── d_gravel.lsp
├── d_tarmac.lsp
└── d_snow.lsp
```

### 2. `rsfdata/setups/{CarName}/` — User/community setups

Saved by users or downloaded from the community. Naming convention: `{surface}_{description}_{author}.lsp`.

```
rsfdata/setups/Skoda_Fabia_S2000_Evo_2_ngp6/
├── gravel_FB_rallyfenegyerek.lsp
├── tarmac_FabiaR5-2022-12-25_Vasgabi.lsp
└── snow_MySetup_username.lsp
```

### 3. `Physics/{CarName}/setups/` — Vanilla car setups

Same structure as `rsfdata/cars/`, but only for the 8 original RBR cars.

```
Physics/c_xsara/setups/
├── d_gravel.lsp
├── d_tarmac.lsp
└── d_snow.lsp
```

### `SavedGames/{CarName}/` — Active setups

What the game actually reads at runtime. Contains copies of default setups (prefixed with RSF car ID, e.g. `42_d_gravel.lsp`) and user-saved setups. Not scanned by the app — these are duplicates of files from the above locations.

## Car Physics Directory

Each car (NGP or vanilla) has its own physics directory with these files:

```
rsfdata/cars/Skoda_Fabia_S2000_Evo_2_ngp6/
├── common.lsp             # Car body, engine, drivetrain, aero
├── gravel.lsp             # Gravel surface: wheel geometry, tyres
├── tarmac.lsp             # Tarmac surface
├── snow.lsp               # Snow surface
├── r_gravel.lsp           # Setup RANGES for gravel (min/max/step)
├── r_tarmac.lsp           # Setup RANGES for tarmac
├── r_snow.lsp             # Setup RANGES for snow
├── repair.ini             # Service park repair times
├── "Car Name"             # Plain text: name, revision, spec date, 3D model ref
└── setups/
    ├── d_gravel.lsp       # Default gravel setup
    ├── d_tarmac.lsp       # Default tarmac setup
    └── d_snow.lsp         # Default snow setup
```

### File purposes

| File | Root element | Purpose |
|------|-------------|---------|
| `common.lsp` | `PhysicsEngine` | Static car properties: mass, CoG, aero, engine torque curve, turbo, thermal model, drivetrain, brakes, body part breakaway |
| `gravel.lsp` / `tarmac.lsp` / `snow.lsp` | `PhysicsEngine` | Per-surface wheel definitions: suspension geometry, tyre dimensions (`_NGP` params) |
| `r_gravel.lsp` / `r_tarmac.lsp` / `r_snow.lsp` | `(null)` | Adjustment ranges for each tunable parameter — min, max, step |
| `d_gravel.lsp` / `d_tarmac.lsp` / `d_snow.lsp` | `CarSetup` | Default setup values |
| `repair.ini` | — | INI file with repair time values for ~76 car parts |

## .lsp Setup File Format

Setup files use a Lisp-like S-expression format. There are two format variants that contain the same logical parameters.

### Default setups (`d_*.lsp`) — "CarSetup" format

```lisp
(("CarSetup"
  Car
  (":-D"
   MaxSteeringLock            900
   FrontRollBarStiffness      10000.0
   RearRollBarStiffness       8000.0
   )
  Drive
  (":-D"
   FrontDiffMaxTorque         30.0
   CenterDiffMaxTorque_NGP    600.0
   RearDiffMaxTorque          200.0
   FrontBrakePressure         3000000.0
   RearBrakePressure          2700000.0
   HandBrakePressure          5000000.0
   ; ... gear IDs, bump stop params
   )
  ; ... more sections
))
```

### User setups — "(null)" format

```lisp
(("(null)"
	Car
	("(null)"
		FrontRollBarStiffness	10000.000
		MaxSteeringLock	900
		RearRollBarStiffness	8000.000
	)
	Drive
	("(null)"
		CenterDiffMaxTorque_NGP	600.000
		FrontBrakePressure	3000000.000
		; ...
	)
))
```

Key differences: root/section IDs are `(null)` instead of `CarSetup`/`:-D`, values are tab-separated, and keys within sections are alphabetically sorted.

### Sections in a setup file

| Section | Parameters |
|---------|-----------|
| `Car` | `MaxSteeringLock`, `FrontRollBarStiffness`, `RearRollBarStiffness` |
| `Drive` | Diff torques (Front/Center/Rear), brake pressures, gear IDs, bump stop params (`_NGP`) |
| `Engine` | `Features_NGP` — encodes drivetrain type + diff types |
| `VehicleControlUnit` | Diff maps: throttle/brake lock percentages at 11 speed points, for front/center/rear/left-foot diffs |
| `WheelLF` / `WheelRF` / `WheelLB` / `WheelRB` | `TopMountSlot`, `SteeringRodLength`, `StrutPlatformHeight`, `WheelAxisInclination` |
| `SpringDamperLF` / `RF` / `LB` / `RB` | Spring length/stiffness, helper spring, bump/rebound damping (low + high speed), high-speed break point |
| `TyreLF` / `TyreRF` / `TyreLB` / `TyreRB` | `Pressure` |

### NGP parameters

Parameters added by the NGP physics plugin are suffixed with `_NGP` (e.g. `CenterDiffMaxTorque_NGP`, `Features_NGP`, `BumpStopStiffness_NGP`). These coexist with vanilla RBR parameters in the same files.

## Range Files

Range files (`r_gravel.lsp`, etc.) define the valid adjustment ranges for the in-game setup screen:

```lisp
(("(null)"
  CarOptions
  ("(null)"
   MaxSteeringLock_range     540 1080 180    ; min max step
   FrontRollBarStiffness_range  0.0 50000.0 1000.0
   )
  SpringDamperOptionsLF
  ("(null)"
   SpringLength_range        0.050 0.250 0.005
   SpringStiffness_range     10000.0 80000.0 5000.0
   BumpSlowDamping_range     1000.0 10000.0 500.0
   )
))
```

Each `_range` key provides three values: minimum, maximum, and step size.

## Vanilla Physics Cars

The `Physics/` directory contains physics for the 8 original RBR cars:

| Directory | Car |
|-----------|-----|
| `c_xsara` | Citroen Xsara |
| `h_accent` | Hyundai Accent |
| `m_lancer` | Mitsubishi Lancer |
| `mg_zr` | MG ZR |
| `p_206` | Peugeot 206 |
| `s_i2000` | Subaru Impreza 2000 |
| `s_i2003` | Subaru Impreza 2003 |
| `t_coroll` | Toyota Corolla |

Plus global files:
- `physics.lsp` — global physics (ground, collisions, solids)
- `michelin/tyres.lsp`, `pirelli/tyres.lsp` — tyre compound definitions

## Cars/ Directory

Contains 3D models and visual configuration. Not used by setup comparison, but referenced by `Cars/Cars.ini` which maps car slots to physics directories:

```ini
[Car00]
CarDir  = "Cars\IMPREZA03\"
PhysicsFile = "Physics\s_i2003"
RSFCarID = 42
RSFCarPhysics = "rsfdata\cars\Skoda_Fabia_S2000_Evo_2_ngp6"
```

## How the App Uses This

The app ([`rbr-scanner.ts`](../src/lib/rbr-scanner.ts)) scans the three setup locations listed above. It:

1. Strips `_ngp6` suffix from directory names and replaces underscores with spaces for display
2. Groups setups by car name
3. Tags setups as `driver-setup` (from default `setups/` dirs) or `user-setup` (from `rsfdata/setups/`)
4. Parses selected `.lsp` files using [`lsp-parser.ts`](../src/lib/lsp-parser.ts) (handles both format variants)
5. Converts raw physics units to display units via [`sanitize.ts`](../src/lib/sanitize.ts) (e.g. N/m → kN/m, m → mm)
6. Merges left/right wheel sections (LF+RF → Front, LB+RB → Back) since they're typically identical
