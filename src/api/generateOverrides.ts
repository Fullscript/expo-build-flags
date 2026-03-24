import type { ExpoConfig } from "@expo/config-types";
import { BuildFlags } from "./BuildFlags";
import { readConfig } from "./readConfig";
import { resolveFlagsToInvert } from "./resolveFlagsToInvert";
import { FlagMap } from "./types";

export const resolveEnabledFlagNames = async ({
  flagsToEnable,
  flagsToDisable,
}: {
  flagsToEnable?: Set<string>;
  flagsToDisable?: Set<string>;
}): Promise<string[]> => {
  const { flags: defaultFlags } = await readConfig();
  const flags = new BuildFlags(defaultFlags);
  if (flagsToEnable) {
    flags.enable(flagsToEnable);
  }
  if (flagsToDisable) {
    flags.disable(flagsToDisable);
  }
  return Object.entries(flags.flags)
    .filter(([_, config]) => config.value)
    .map(([name]) => name);
};

/**
 * Apply explicit flag overrides and write a single runtime module.
 * Used by the CLI when the user provides +flag / -flag arguments.
 */
export const generateOverrides = async ({
  flagsToEnable,
  flagsToDisable,
  enableBranchFlags,
}: {
  flagsToEnable?: Set<string>;
  flagsToDisable?: Set<string>;
  enableBranchFlags?: boolean;
}) => {
  const { mergePath, flags: defaultFlags } = await readConfig();
  const flags = new BuildFlags(defaultFlags);
  if (enableBranchFlags) {
    flags.enableBranchFlags();
  }
  if (flagsToEnable) {
    flags.enable(flagsToEnable);
  }
  if (flagsToDisable) {
    flags.disable(flagsToDisable);
  }
  await flags.save(mergePath);
};

const hasPlatformInversions = (flags: FlagMap) =>
  Object.values(flags).some(
    (config) => config.invertFor?.platform?.length
  );

const resolveForPlatform = async (
  defaultFlags: FlagMap,
  platform: "ios" | "android",
  expoConfig?: ExpoConfig
): Promise<BuildFlags> => {
  const flags = new BuildFlags(structuredClone(defaultFlags));
  const invertable = await resolveFlagsToInvert(expoConfig, platform);
  if (invertable.flagsToEnable.size > 0) {
    flags.enable(invertable.flagsToEnable);
  }
  if (invertable.flagsToDisable.size > 0) {
    flags.disable(invertable.flagsToDisable);
  }
  return flags;
};

const flagMapsEqual = (a: FlagMap, b: FlagMap) => {
  const keysA = Object.keys(a).sort();
  const keysB = Object.keys(b).sort();
  if (keysA.length !== keysB.length) return false;
  return keysA.every(
    (key, i) => key === keysB[i] && a[key].value === b[key].value
  );
};

/**
 * Resolve the source-of-truth flags from flags.yml, including platform
 * inversions and bundleId inversions. Writes platform-specific files
 * (.ios.ts / .android.ts) when flags differ between platforms, otherwise
 * writes a single file. Used by the CLI with no override args and by the
 * config plugin.
 */
export const generateSourceOfTruth = async ({
  expoConfig,
  enableBranchFlags,
  envFlagsToEnable,
}: {
  expoConfig?: ExpoConfig;
  enableBranchFlags?: boolean;
  envFlagsToEnable?: Set<string>;
} = {}) => {
  const { mergePath, flags: defaultFlags } = await readConfig();

  const iosFlags = await resolveForPlatform(defaultFlags, "ios", expoConfig);
  const androidFlags = await resolveForPlatform(
    defaultFlags,
    "android",
    expoConfig
  );

  if (enableBranchFlags) {
    iosFlags.enableBranchFlags();
    androidFlags.enableBranchFlags();
  }

  if (envFlagsToEnable && envFlagsToEnable.size > 0) {
    iosFlags.enable(envFlagsToEnable);
    androidFlags.enable(envFlagsToEnable);
  }

  if (
    hasPlatformInversions(defaultFlags) &&
    !flagMapsEqual(iosFlags.flags, androidFlags.flags)
  ) {
    await iosFlags.savePlatformSpecific(
      mergePath,
      iosFlags.flags,
      androidFlags.flags
    );
    return;
  }

  // No platform differences — write single file (use ios, they're equal)
  await iosFlags.save(mergePath);
};
