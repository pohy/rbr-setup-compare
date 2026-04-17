// Editable (section, key) whitelist ported from rbr-setup-studio
// app.js:5664+ (`FIELD_DEFS`). Section names use RAW (pre-rename) form.
// Mirror sides (RF, RB) are absent — compare.ts discards them via
// SECTION_MIRRORS and the LF/LB values carry.
//
// Anything not in the whitelist is treated as readonly. Gear hijack
// (Gear0-7 Options repurposed as NGP params) is handled implicitly by
// omitting GearId0..GearId7 from the set; only DropGearId stays
// editable.
const EDITABLE_FIELDS: ReadonlySet<string> = new Set([
  "Car.MaxSteeringLock",
  "Car.FrontRollBarStiffness",
  "Car.RearRollBarStiffness",

  "Drive.MaxBrakePressureFront",
  "Drive.MaxBrakePressureRear",
  "Drive.HandbrakePercentage_NGP",
  "Drive.CenterDiffMaxTorque",
  "Drive.FrontDiffMaxTorque",
  "Drive.RearDiffMaxTorque",
  "Drive.DropGearId",
  "Drive.BumpStopStiffnessFront_NGP",
  "Drive.BumpStopStiffnessRear_NGP",
  "Drive.BumpStopDampingBumpFront_NGP",
  "Drive.BumpStopDampingBumpRear_NGP",
  "Drive.BumpStopDampingReboundFront_NGP",
  "Drive.BumpStopDampingReboundRear_NGP",
  "Drive.HighSpeedBreakReboundFront_NGP",
  "Drive.HighSpeedBreakReboundRear_NGP",
  "Drive.HighSpeedDampingReboundFront_NGP",
  "Drive.HighSpeedDampingReboundRear_NGP",

  "VehicleControlUnit.CenterDiffHandbrakeRelease",
  "VehicleControlUnit.LeftFootBrakeThreshold",

  "SpringDamperLF.SpringLength",
  "SpringDamperLF.SpringStiffness",
  "SpringDamperLF.HelperSpringLength",
  "SpringDamperLF.HelperSpringStiffness",
  "SpringDamperLF.DampingBump",
  "SpringDamperLF.DampingRebound",
  "SpringDamperLF.DampingBumpHighSpeed",
  "SpringDamperLF.BumpHighSpeedBreak",
  "SpringDamperLB.SpringLength",
  "SpringDamperLB.SpringStiffness",
  "SpringDamperLB.HelperSpringLength",
  "SpringDamperLB.HelperSpringStiffness",
  "SpringDamperLB.DampingBump",
  "SpringDamperLB.DampingRebound",
  "SpringDamperLB.DampingBumpHighSpeed",
  "SpringDamperLB.BumpHighSpeedBreak",

  "WheelLF.TopMountSlot",
  "WheelLF.SteeringRodLength",
  "WheelLF.StrutPlatformHeight",
  "WheelLF.WheelAxisInclination",
  "WheelLB.TopMountSlot",
  "WheelLB.SteeringRodLength",
  "WheelLB.StrutPlatformHeight",
  "WheelLB.WheelAxisInclination",

  "TyreLF.Pressure",
  "TyreLB.Pressure",
]);

// Indexed diff-map curve points. rbr-setup-studio treats these via a
// dedicated map editor; we inline them in the comparison table so they
// stay editable.
const EDITABLE_INDEXED_RE =
  /^VehicleControlUnit\.(?:Center|Front|Rear|LFCenter)Diff(?:Throttle|Brake)_\d{2}$/;

export function isWhitelistedPath(rawSection: string, key: string): boolean {
  const path = `${rawSection}.${key}`;
  if (EDITABLE_FIELDS.has(path)) {
    return true;
  }
  return EDITABLE_INDEXED_RE.test(path);
}
