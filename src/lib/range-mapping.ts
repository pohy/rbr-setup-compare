import type { RangeTriplet, RawRangeData } from "./range-parser.ts";

export type RangeMap = Map<string, Map<string, RangeTriplet>>;

const SECTION_MAP: Record<string, string> = {
  CarOptions: "Car",
  DriveOptions: "Drive",
  ControlOptions: "VehicleControlUnit",
  SpringDamperOptionsLF: "SpringDamperLF",
  SpringDamperOptionsRF: "SpringDamperRF",
  SpringDamperOptionsLB: "SpringDamperLB",
  SpringDamperOptionsRB: "SpringDamperRB",
  TyreOptionsLF: "TyreLF",
  TyreOptionsRF: "TyreRF",
  TyreOptionsLB: "TyreLB",
  TyreOptionsRB: "TyreRB",
  WheelOptionsLF: "WheelLF",
  WheelOptionsRF: "WheelRF",
  WheelOptionsLB: "WheelLB",
  WheelOptionsRB: "WheelRB",
};

const KEY_MAP: Record<string, string> = {
  FrontBrakePressure: "MaxBrakePressureFront",
  RearBrakePressure: "MaxBrakePressureRear",
  CenterDiffTorque: "CenterDiffMaxTorque",
  FrontDiffTorque: "FrontDiffMaxTorque",
  RearDiffTorque: "RearDiffMaxTorque",
  DampBump: "DampingBump",
  DampRebound: "DampingRebound",
  DampBumpHiSpeed: "DampingBumpHighSpeed",
  DampSpeedBrake: "BumpHighSpeedBreak",
  SteeringRod: "SteeringRodLength",
  WheelAxisIncl: "WheelAxisInclination",
  PlatformHeight: "StrutPlatformHeight",
  CenterDiffHandbrakeRelease: "CenterDiffHandbrakeRelease",
  LeftFootBrakeThreshold: "LeftFootBrakeThreshold",
};

const DIFF_PREFIXES = ["CenterDiff", "FrontDiff", "RearDiff", "LFCenterDiff"];
const DIFF_TYPES = ["Throttle", "Brake"];

function addToSection(result: RangeMap, section: string, key: string, triplet: RangeTriplet) {
  let sectionMap = result.get(section);
  if (!sectionMap) {
    sectionMap = new Map();
    result.set(section, sectionMap);
  }
  sectionMap.set(key, triplet);
}

export function mapRangesToSetup(raw: RawRangeData): RangeMap {
  const result: RangeMap = new Map();

  for (const [rangeSection, triplets] of raw) {
    const setupSection = SECTION_MAP[rangeSection];
    if (!setupSection) continue;

    for (const [rangeKey, triplet] of triplets) {
      // Special expansion: DiffMapLock in ControlOptions
      if (rangeKey === "DiffMapLock" && setupSection === "VehicleControlUnit") {
        for (const prefix of DIFF_PREFIXES) {
          for (const type of DIFF_TYPES) {
            for (let i = 0; i <= 10; i++) {
              const key = `${prefix}${type}_${String(i).padStart(2, "0")}`;
              addToSection(result, setupSection, key, triplet);
            }
          }
        }
        continue;
      }

      // Special expansion: BumpStopStiffness_NGP in DriveOptions
      if (rangeKey === "BumpStopStiffness_NGP" && setupSection === "Drive") {
        addToSection(result, setupSection, "BumpStopStiffnessFront_NGP", triplet);
        addToSection(result, setupSection, "BumpStopStiffnessRear_NGP", triplet);
        continue;
      }

      // Special expansion: BumpStopDamping_NGP in DriveOptions
      if (rangeKey === "BumpStopDamping_NGP" && setupSection === "Drive") {
        addToSection(result, setupSection, "BumpStopDampingBumpFront_NGP", triplet);
        addToSection(result, setupSection, "BumpStopDampingBumpRear_NGP", triplet);
        addToSection(result, setupSection, "BumpStopDampingReboundFront_NGP", triplet);
        addToSection(result, setupSection, "BumpStopDampingReboundRear_NGP", triplet);
        continue;
      }

      // Normal mapping: apply key rename or pass through
      const setupKey = KEY_MAP[rangeKey] ?? rangeKey;
      addToSection(result, setupSection, setupKey, triplet);
    }
  }

  return result;
}

export function getRangeForKey(
  rangeMap: RangeMap,
  section: string,
  key: string,
): RangeTriplet | undefined {
  return rangeMap.get(section)?.get(key);
}
