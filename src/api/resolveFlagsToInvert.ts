import type { ExpoConfig } from "@expo/config-types";

import { BuildFlags } from "./BuildFlags";
import { readConfig } from "./readConfig";
import { InvertableFlagTuple } from "./types";

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

export const resolveFlagsToInvert = async (expoConfig: ExpoConfig) => {
  const { flags } = await readConfig();
  const invertable = Object.entries(flags).filter(
    (tuple): tuple is InvertableFlagTuple => !!tuple[1].invertFor
  );

  const flagsToEnable = new Set<string>();
  const flagsToDisable = new Set<string>();

  if (!invertable.length) {
    return { flagsToEnable, flagsToDisable };
  }

  invertable.forEach(([flagName, flagConfig]) => {
    const invertFor = flagConfig.invertFor;

    if (invertFor.bundleId) {
      const bundleIds = [
        expoConfig.ios?.bundleIdentifier,
        expoConfig.android?.package,
      ].filter(Boolean);
      if (
        !bundleIds.length ||
        !invertFor.bundleId.find((bundleId) => bundleIds.includes(bundleId))
      ) {
        return;
      }
    }

    if (flagConfig.value) {
      flagsToDisable.add(flagName);
    } else {
      flagsToEnable.add(flagName);
    }
  });

  return { flagsToEnable, flagsToDisable };
};
