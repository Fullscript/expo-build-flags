import {
  ConfigPlugin,
  createRunOncePlugin,
  Mod,
  withAndroidManifest,
  withDangerousMod,
  withInfoPlist,
} from "@expo/config-plugins";
import { ExpoConfig } from "@expo/config-types";
import { generateOverrides, resolveFlagsToInvert } from "../api";
import pkg from "../../package.json";
import { withFlaggedAutolinking } from "./withFlaggedAutolinking";
import { mergeSets } from "../api/mergeSets";

const withAndroidBuildFlags: ConfigPlugin<{ flags: string[] }> = (
  config,
  props
) => {
  return withAndroidManifest(config, (config) => {
    if (!config.modResults) {
      throw new Error("AndroidManifest.xml not found in the project");
    }

    const mainApplication = config.modResults.manifest?.application?.[0];
    if (!mainApplication) {
      throw new Error("Application node not found in AndroidManifest.xml");
    }

    const meta = mainApplication["meta-data"];
    mainApplication["meta-data"] = [
      ...(meta ?? []),
      {
        $: {
          "android:name": "EXBuildFlags",
          "android:value": props.flags.join(","),
        },
      },
    ];

    return config;
  });
};

const withAppleBuildFlags: ConfigPlugin<{ flags: string[] }> = (
  config,
  props
) => {
  return withInfoPlist(config, (config) => {
    config.modResults.EXBuildFlags = props.flags;
    return config;
  });
};

type BundlePluginProps = { flags: string[] };

const createCrossPlatformMod =
  ({
    config,
    props,
  }: {
    config: ExpoConfig;
    props: BundlePluginProps;
  }): Mod<unknown> =>
  async (modConfig) => {
    const { flags } = props;
    let flagsToEnable = new Set(flags);
    const invertable = await resolveFlagsToInvert(config);
    if (invertable.flagsToEnable.size > 0) {
      flagsToEnable = mergeSets(flagsToEnable, invertable.flagsToEnable);
    }
    await generateOverrides({
      flagsToEnable,
      flagsToDisable: invertable.flagsToDisable,
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

const withBundleFlags: ConfigPlugin<{ flags: string[] }> = (config, props) => {
  return withAppleBundleBuildFlags(
    withAndroidBundleBuildFlags(config, props),
    props
  );
};

const parseEnvFlags = () => {
  const envFlags = process.env.EXPO_BUILD_FLAGS;
  if (!envFlags) {
    return [];
  }

  const flags = new Set<string>();

  envFlags.split(",").forEach((flag) => {
    flags.add(flag.trim());
  });

  return Array.from(flags);
};

type ConfigPluginProps =
  | { skipBundleOverride?: boolean; flaggedAutolinking?: boolean }
  | undefined;

type WithBuildFlagsProps = { skipBundleOverride?: boolean; flags: string[] };

const withBuildFlags: ConfigPlugin<WithBuildFlagsProps> = (config, props) => {
  const flags = props.flags;
  if (!flags.length) {
    return props?.skipBundleOverride
      ? config
      : withBundleFlags(config, { flags });
  }

  const nativeConfig = withAndroidBuildFlags(config, { flags });
  const mergedNativeConfig = withAppleBuildFlags(nativeConfig, { flags });
  if (props?.skipBundleOverride) {
    return mergedNativeConfig;
  }

  return withBundleFlags(mergedNativeConfig, { flags });
};

const withBuildFlagsAndLinking: ConfigPlugin<ConfigPluginProps> = (
  config,
  props
) => {
  let mergedConfig = config;
  const flags = parseEnvFlags();

  if (props?.flaggedAutolinking) {
    mergedConfig = withFlaggedAutolinking(mergedConfig, { flags });
  }

  return withBuildFlags(config, { ...props, flags });
};

export default createRunOncePlugin(
  withBuildFlagsAndLinking,
  pkg.name,
  pkg.version
);
