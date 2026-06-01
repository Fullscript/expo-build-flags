import {
  ConfigPlugin,
  createRunOncePlugin,
  Mod,
  withAndroidManifest,
  withDangerousMod,
  withInfoPlist,
} from "@expo/config-plugins";
import { ExpoConfig } from "@expo/config-types";
import {
  generateOverrides,
  resolveEnabledFlagNames,
  resolveFlagsToInvert,
} from "../api";
import pkg from "../../package.json";
import { withFlaggedAutolinking } from "./withFlaggedAutolinking";
import { mergeSets } from "../api/mergeSets";
import { parseEnvFlags } from "./parseEnvFlags";

type EnvFlagSets = {
  flagsToEnable: Set<string>;
  flagsToDisable: Set<string>;
};

type NativeFlagPluginProps = EnvFlagSets & { expoConfig: ExpoConfig };

let cachedResolvedFlags: string[] | null = null;
const resolveAllEnabledFlags = async ({
  flagsToEnable: envEnable,
  flagsToDisable: envDisable,
  expoConfig,
}: NativeFlagPluginProps): Promise<string[]> => {
  if (cachedResolvedFlags) {
    return cachedResolvedFlags;
  }
  let flagsToEnable = new Set(envEnable);
  let flagsToDisable = new Set(envDisable);
  const invertable = await resolveFlagsToInvert(expoConfig);
  if (invertable.flagsToEnable.size > 0) {
    flagsToEnable = mergeSets(flagsToEnable, invertable.flagsToEnable);
  }
  if (invertable.flagsToDisable.size > 0) {
    flagsToDisable = mergeSets(flagsToDisable, invertable.flagsToDisable);
  }
  cachedResolvedFlags = await resolveEnabledFlagNames({
    flagsToEnable,
    flagsToDisable,
  });
  return cachedResolvedFlags;
};

const withAndroidBuildFlags: ConfigPlugin<NativeFlagPluginProps> = (
  config,
  props
) => {
  return withAndroidManifest(config, async (config) => {
    if (!config.modResults) {
      throw new Error("AndroidManifest.xml not found in the project");
    }

    const mainApplication = config.modResults.manifest?.application?.[0];
    if (!mainApplication) {
      throw new Error("Application node not found in AndroidManifest.xml");
    }

    const resolvedFlags = await resolveAllEnabledFlags(props);

    const meta = mainApplication["meta-data"];
    mainApplication["meta-data"] = [
      ...(meta ?? []),
      {
        $: {
          "android:name": "EXBuildFlags",
          "android:value": resolvedFlags.join(","),
        },
      },
    ];

    return config;
  });
};

const withAppleBuildFlags: ConfigPlugin<NativeFlagPluginProps> = (
  config,
  props
) => {
  return withInfoPlist(config, async (config) => {
    const resolvedFlags = await resolveAllEnabledFlags(props);
    config.modResults.EXBuildFlags = resolvedFlags;
    return config;
  });
};

type BundlePluginProps = EnvFlagSets;

const createCrossPlatformMod =
  ({
    config,
    props,
  }: {
    config: ExpoConfig;
    props: BundlePluginProps;
  }): Mod<unknown> =>
  async (modConfig) => {
    let flagsToEnable = new Set(props.flagsToEnable);
    let flagsToDisable = new Set(props.flagsToDisable);
    const invertable = await resolveFlagsToInvert(config);
    if (invertable.flagsToEnable.size > 0) {
      flagsToEnable = mergeSets(flagsToEnable, invertable.flagsToEnable);
    }
    if (invertable.flagsToDisable.size > 0) {
      flagsToDisable = mergeSets(flagsToDisable, invertable.flagsToDisable);
    }
    await generateOverrides({
      flagsToEnable,
      flagsToDisable,
    });
    return modConfig;
  };

const withAndroidBundleBuildFlags: ConfigPlugin<BundlePluginProps> = (
  config,
  props
) => {
  return withDangerousMod(config, [
    "android",
    createCrossPlatformMod({ config, props }),
  ]);
};

const withAppleBundleBuildFlags: ConfigPlugin<BundlePluginProps> = (
  config,
  props
) => {
  return withDangerousMod(config, [
    "ios",
    createCrossPlatformMod({ config, props }),
  ]);
};

const withBundleFlags: ConfigPlugin<BundlePluginProps> = (config, props) => {
  return withAppleBundleBuildFlags(
    withAndroidBundleBuildFlags(config, props),
    props
  );
};

type ConfigPluginProps =
  | { skipBundleOverride?: boolean; flaggedAutolinking?: boolean }
  | undefined;

type WithBuildFlagsProps = EnvFlagSets & { skipBundleOverride?: boolean };

const withBuildFlags: ConfigPlugin<WithBuildFlagsProps> = (config, props) => {
  const { flagsToEnable, flagsToDisable } = props;
  const nativeProps = { flagsToEnable, flagsToDisable, expoConfig: config };

  const nativeConfig = withAndroidBuildFlags(config, nativeProps);
  const mergedNativeConfig = withAppleBuildFlags(nativeConfig, nativeProps);
  if (props?.skipBundleOverride) {
    return mergedNativeConfig;
  }

  return withBundleFlags(mergedNativeConfig, { flagsToEnable, flagsToDisable });
};

const withBuildFlagsAndLinking: ConfigPlugin<ConfigPluginProps> = (
  config,
  props
) => {
  let mergedConfig = config;
  const { flagsToEnable, flagsToDisable } = parseEnvFlags();

  if (props?.flaggedAutolinking) {
    // Autolinking only consults the enable list: a flag forced ON at build time
    // should not have its native modules excluded. Disabling a default-true flag
    // via env does not currently re-introduce module exclusions for it; that
    // would require resolving the merged flag state before computing exclusions.
    mergedConfig = withFlaggedAutolinking(mergedConfig, {
      flags: Array.from(flagsToEnable),
    });
  }

  return withBuildFlags(config, { ...props, flagsToEnable, flagsToDisable });
};

export default createRunOncePlugin(
  withBuildFlagsAndLinking,
  pkg.name,
  pkg.version
);
