import {
  ConfigPlugin,
  createRunOncePlugin,
  Mod,
  withAndroidManifest,
  withDangerousMod,
  withInfoPlist,
} from "@expo/config-plugins";
import { ExpoConfig } from "@expo/config-types";
import { generateOverrides, resolveEnabledFlagNames } from "../api";
import pkg from "../../package.json";
import { withFlaggedAutolinking } from "./withFlaggedAutolinking";
import { parseEnvFlags } from "./parseEnvFlags";
import { debug } from "../api/debug";

type EnvFlagSets = {
  flagsToEnable: Set<string>;
  flagsToDisable: Set<string>;
};

type NativeFlagPluginProps = EnvFlagSets & { expoConfig: ExpoConfig };

const resolveEnabledFor = (
  props: NativeFlagPluginProps,
  platform: "ios" | "android"
) =>
  resolveEnabledFlagNames({
    flagsToEnable: props.flagsToEnable,
    flagsToDisable: props.flagsToDisable,
    expoConfig: props.expoConfig,
    platform,
  });

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

    const resolvedFlags = await resolveEnabledFor(props, "android");
    debug(
      "writing EXBuildFlags to AndroidManifest.xml: %s",
      resolvedFlags.join(",")
    );

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
    const resolvedFlags = await resolveEnabledFor(props, "ios");
    debug("writing EXBuildFlags to Info.plist: %o", resolvedFlags);
    config.modResults.EXBuildFlags = resolvedFlags;
    return config;
  });
};

type BundlePluginProps = NativeFlagPluginProps;

const createBundleMod =
  (props: BundlePluginProps): Mod<unknown> =>
  async (modConfig) => {
    if (bundleGenerated) {
      return modConfig;
    }
    bundleGenerated = true;
    await generateOverrides({
      flagsToEnable: props.flagsToEnable,
      flagsToDisable: props.flagsToDisable,
      expoConfig: props.expoConfig,
    });
    return modConfig;
  };

// generateOverrides resolves both platforms internally and writes the runtime
// module(s) in one shot, so we only need to run once. We register the mod on
// both platforms (guarded) so a single-platform prebuild (e.g. `-p android`)
// still regenerates the module.
let bundleGenerated = false;

const withBundleFlags: ConfigPlugin<BundlePluginProps> = (config, props) => {
  return withDangerousMod(
    withDangerousMod(config, ["ios", createBundleMod(props)]),
    ["android", createBundleMod(props)]
  );
};

type ConfigPluginProps =
  | { skipBundleOverride?: boolean; flaggedAutolinking?: boolean }
  | undefined;

type WithBuildFlagsProps = NativeFlagPluginProps & {
  skipBundleOverride?: boolean;
};

const withBuildFlags: ConfigPlugin<WithBuildFlagsProps> = (config, props) => {
  const nativeProps = {
    flagsToEnable: props.flagsToEnable,
    flagsToDisable: props.flagsToDisable,
    expoConfig: config,
  };

  const nativeConfig = withAndroidBuildFlags(config, nativeProps);
  const mergedNativeConfig = withAppleBuildFlags(nativeConfig, nativeProps);
  if (props?.skipBundleOverride) {
    return mergedNativeConfig;
  }

  return withBundleFlags(mergedNativeConfig, nativeProps);
};

const withBuildFlagsAndLinking: ConfigPlugin<ConfigPluginProps> = (
  config,
  props
) => {
  let mergedConfig = config;
  const { flagsToEnable, flagsToDisable } = parseEnvFlags();

  if (props?.flaggedAutolinking) {
    mergedConfig = withFlaggedAutolinking(mergedConfig, {
      flagsToEnable,
      flagsToDisable,
      expoConfig: config,
    });
  }

  return withBuildFlags(mergedConfig, {
    ...props,
    flagsToEnable,
    flagsToDisable,
    expoConfig: config,
  });
};

export default createRunOncePlugin(
  withBuildFlagsAndLinking,
  pkg.name,
  pkg.version
);
