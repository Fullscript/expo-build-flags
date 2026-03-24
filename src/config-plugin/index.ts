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
  generateSourceOfTruth,
  resolveEnabledFlagNames,
  resolveFlagsToInvert,
} from "../api";
import pkg from "../../package.json";
import { withFlaggedAutolinking } from "./withFlaggedAutolinking";
import { mergeSets } from "../api/mergeSets";

type NativeFlagPluginProps = { envFlags: string[]; expoConfig: ExpoConfig };

const cachedResolvedFlags: Record<string, string[]> = {};
const resolveAllEnabledFlags = async (
  envFlags: string[],
  expoConfig: ExpoConfig,
  platform: "ios" | "android"
): Promise<string[]> => {
  if (cachedResolvedFlags[platform]) {
    return cachedResolvedFlags[platform];
  }
  let flagsToEnable = new Set(envFlags);
  const invertable = await resolveFlagsToInvert(expoConfig, platform);
  if (invertable.flagsToEnable.size > 0) {
    flagsToEnable = mergeSets(flagsToEnable, invertable.flagsToEnable);
  }
  cachedResolvedFlags[platform] = await resolveEnabledFlagNames({
    flagsToEnable,
    flagsToDisable: invertable.flagsToDisable,
  });
  return cachedResolvedFlags[platform];
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

    const resolvedFlags = await resolveAllEnabledFlags(
      props.envFlags,
      props.expoConfig,
      "android"
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
    const resolvedFlags = await resolveAllEnabledFlags(
      props.envFlags,
      props.expoConfig,
      "ios"
    );
    config.modResults.EXBuildFlags = resolvedFlags;
    return config;
  });
};

type BundlePluginProps = { flags: string[]; expoConfig: ExpoConfig };

let bundleFlagsGenerated = false;

const createBundleFlagsMod =
  ({
    props,
  }: {
    props: BundlePluginProps;
  }): Mod<unknown> =>
  async (modConfig) => {
    if (bundleFlagsGenerated) {
      return modConfig;
    }
    bundleFlagsGenerated = true;

    const envFlagsToEnable = new Set(props.flags);

    await generateSourceOfTruth({
      expoConfig: props.expoConfig,
      envFlagsToEnable: envFlagsToEnable.size > 0 ? envFlagsToEnable : undefined,
    });
    return modConfig;
  };

const withBundleFlags: ConfigPlugin<BundlePluginProps> = (config, props) => {
  return withDangerousMod(
    withDangerousMod(config, [
      "android",
      createBundleFlagsMod({ props }),
    ]),
    [
      "ios",
      createBundleFlagsMod({ props }),
    ]
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
  const { flags } = props;
  const nativeProps = { envFlags: flags, expoConfig: config };

  const nativeConfig = withAndroidBuildFlags(config, nativeProps);
  const mergedNativeConfig = withAppleBuildFlags(nativeConfig, nativeProps);
  if (props?.skipBundleOverride) {
    return mergedNativeConfig;
  }

  return withBundleFlags(mergedNativeConfig, { flags, expoConfig: config });
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

  return withBuildFlags(mergedConfig, { ...props, flags });
};

export default createRunOncePlugin(
  withBuildFlagsAndLinking,
  pkg.name,
  pkg.version
);
