import type { ExpoConfig } from "@expo/config-types";

import { readConfig } from "./readConfig";
import { InvertableFlagTuple } from "./types";

export const resolveFlagsToInvert = async (
  expoConfig?: ExpoConfig,
  platform?: "ios" | "android"
) => {
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
    let shouldInvert = false;

    if (invertFor.bundleId && expoConfig) {
      const bundleIds = [
        expoConfig.ios?.bundleIdentifier,
        expoConfig.android?.package,
      ].filter(Boolean);
      if (
        bundleIds.length &&
        invertFor.bundleId.some((id) => bundleIds.includes(id))
      ) {
        shouldInvert = true;
      }
    }

    if (invertFor.platform && platform) {
      if (invertFor.platform.includes(platform)) {
        shouldInvert = true;
      }
    }

    if (!shouldInvert) {
      return;
    }

    if (flagConfig.value) {
      flagsToDisable.add(flagName);
    } else {
      flagsToEnable.add(flagName);
    }
  });

  return { flagsToEnable, flagsToDisable };
};
