/**
 * LSP key → in-game editor label mapping.
 * Sourced from docs/ngp-setup-validation.md § "LSP key → in-game editor label mapping".
 */

const LABEL_MAP: Record<string, string> = {
  // Car
  MaxSteeringLock: "Max Steering Lock",
  FrontRollBarStiffness: "Front Roll Bar",
  RearRollBarStiffness: "Rear Roll Bar",

  // Brakes
  MaxBrakePressureFront: "Front Brake Pressure",
  MaxBrakePressureRear: "Rear Brake Pressure",
  HandbrakePercentage_NGP: "Handbrake Pressure",

  // Gearbox
  GearId0: "Reverse",
  GearId1: "Neutral",
  GearId2: "Gear 1",
  GearId3: "Gear 2",
  GearId4: "Gear 3",
  GearId5: "Gear 4",
  GearId6: "Gear 5",
  GearId7: "Gear 6",
  FinalDriveId: "Final Drive",
  DropGearId: "Drop Gear",

  // Differentials
  CenterDiffMaxTorque: "Center Diff. Preload Torque",
  FrontDiffMaxTorque: "Front Diff. Preload Torque",
  RearDiffMaxTorque: "Rear Diff. Preload Torque",

  // Bump Stops (NGP)
  BumpStopStiffnessFront_NGP: "Stiffness (front)",
  BumpStopStiffnessRear_NGP: "Stiffness (rear)",
  BumpStopDampingBumpFront_NGP: "Bump Damping (front)",
  BumpStopDampingBumpRear_NGP: "Bump Damping (rear)",
  BumpStopDampingReboundFront_NGP: "Rebound Damping (front)",
  BumpStopDampingReboundRear_NGP: "Rebound Damping (rear)",

  // Fast Rebound (NGP)
  HighSpeedBreakReboundFront_NGP: "Fast Rebound Threshold (front)",
  HighSpeedDampingReboundFront_NGP: "Fast Rebound (front)",
  HighSpeedBreakReboundRear_NGP: "Fast Rebound Threshold (rear)",
  HighSpeedDampingReboundRear_NGP: "Fast Rebound (rear)",

  // Diff Maps (non-indexed)
  CenterDiffHandbrakeRelease: "Handbrake Release",
  LeftFootBrakeThreshold: "Left Foot Brake",

  // Wheel
  TopMountSlot: "Top Mount",
  SteeringRodLength: "Steering Rod",
  StrutPlatformHeight: "Ride Height",
  WheelAxisInclination: "Camber",

  // SpringDamper
  SpringLength: "Spring Length",
  SpringStiffness: "Spring Rate",
  HelperSpringLength: "Helper Spring Length",
  HelperSpringStiffness: "Helper Spring Stiffness",
  DampingBump: "Bump",
  DampingRebound: "Rebound",
  DampingBumpHighSpeed: "Fast Bump",
  BumpHighSpeedBreak: "Fast Bump Threshold",

  // Tyre
  Pressure: "Pressure",
};

/** Indexed diff map base keys → in-game labels */
const INDEXED_LABEL_MAP: Record<string, string> = {
  CenterDiffThrottle: "Center Throttle Lock",
  CenterDiffBrake: "Center Brake Lock",
  LFCenterDiffThrottle: "LF Center Throttle Lock",
  LFCenterDiffBrake: "LF Center Brake Lock",
  FrontDiffThrottle: "Front Throttle Lock",
  FrontDiffBrake: "Front Brake Lock",
  RearDiffThrottle: "Rear Throttle Lock",
  RearDiffBrake: "Rear Brake Lock",
};

/** Sanitized section name → in-game editor page label */
const SECTION_LABEL_MAP: Record<string, string> = {
  Car: "Steering / Roll Bars",
  WheelFront: "Suspension (Front)",
  WheelBack: "Suspension (Rear)",
  SpringDamperFront: "Springs & Dampers (Front)",
  SpringDamperBack: "Springs & Dampers (Rear)",
  TyreFront: "Tyres (Front)",
  TyreBack: "Tyres (Rear)",
  VehicleControlUnit: "Differential Maps",
};

const INDEXED_SUFFIX = /^(.+)_(\d{2})$/;

export function getLabel(key: string): string {
  const direct = LABEL_MAP[key];
  if (direct) {
    return direct;
  }

  const match = INDEXED_SUFFIX.exec(key);
  if (match) {
    const base = INDEXED_LABEL_MAP[match[1]];
    if (base) {
      return `${base} ${Number(match[2])}`;
    }
  }

  return key;
}

export function getSectionLabel(section: string): string {
  return SECTION_LABEL_MAP[section] ?? section;
}
