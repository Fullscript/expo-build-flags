import fs from "fs";
import path from "path";
import { ConfigPlugin, withDangerousMod } from "@expo/config-plugins";
import { readConfigModuleExclusions } from "../api/readConfig";
import { debug } from "../api/debug";

type Props = { flags: string[]; expoMajorVersion: number };

type Updater = (contents: string, { exclude }: { exclude: string[] }) => string;

const appleRNLinkingLookup: Record<number | "default", Updater> = {
  51: updatePodfileReactNativeAutolinkCallForSDK51,
  52: updatePodfileReactNativeAutolinkCallForSDK52,
  default: updatePodfileReactNativeAutolinkCallForSDK52,
};

const appleExpoLinkingLookup: Record<number | "default", Updater> = {
  51: updatePodfileExpoModulesAutolinkCall,
  52: updatePodfileExpoModulesAutolinkCall,
  default: updatePodfileExpoModulesAutolinkCall,
};

const androidExpoLinkingLookup: Record<number | "default", Updater> = {
  51: updateGradleExpoModulesAutolinkCall,
  52: updateGradleExpoModulesAutolinkCall,
  53: updateGradleExpoModulesAutolinkCall,
  54: updateGradleExpoModulesAutolinkCallForSDK54,
  default: updateGradleExpoModulesAutolinkCallForSDK54,
};

const androidRNLinkingLookup: Record<number | "default", Updater> = {
  51: updateGradleReactNativeAutolinkCall,
  52: updateGradleReactNativeAutolinkCall,
  53: updateGradleReactNativeAutolinkCall,
  54: updateGradleReactNativeAutolinkCallForSDK54,
  default: updateGradleReactNativeAutolinkCallForSDK54,
};

const withFlaggedAutolinkingForApple: ConfigPlugin<Props> = (
  config,
  { flags, expoMajorVersion }
) => {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfile = path.join(
        config.modRequest.platformProjectRoot,
        "Podfile"
      );
      let contents = await fs.promises.readFile(podfile, "utf8");
      const exclude = await getExclusions(flags);
      if (!exclude.length) {
        return config;
      }

      const setupRNModuleLinking =
        appleRNLinkingLookup[expoMajorVersion] || appleRNLinkingLookup.default;
      const setupExpoModuleLinking =
        appleExpoLinkingLookup[expoMajorVersion] ||
        appleExpoLinkingLookup.default;

      contents = setupRNModuleLinking(contents, { exclude });
      contents = setupExpoModuleLinking(contents, { exclude });
      debug(
        "writing autolinking exclusions to Podfile %s: %o",
        podfile,
        exclude
      );
      await fs.promises.writeFile(podfile, contents, "utf8");
      return config;
    },
  ]);
};

const withFlaggedAutolinkingForAndroid: ConfigPlugin<Props> = (
  config,
  { flags, expoMajorVersion }
) => {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const gradleSettings = path.join(
        config.modRequest.platformProjectRoot,
        "settings.gradle"
      );
      let contents = await fs.promises.readFile(gradleSettings, "utf8");
      const exclude = await getExclusions(flags);
      if (!exclude.length) {
        return config;
      }
      const setupRNModuleLinking =
        androidRNLinkingLookup[expoMajorVersion] ||
        androidRNLinkingLookup.default;
      const setupExpoModuleLinking =
        androidExpoLinkingLookup[expoMajorVersion] ||
        androidExpoLinkingLookup.default;
      contents = setupRNModuleLinking(contents, { exclude });
      contents = setupExpoModuleLinking(contents, { exclude });
      debug(
        "writing autolinking exclusions to settings.gradle %s: %o",
        gradleSettings,
        exclude
      );
      await fs.promises.writeFile(gradleSettings, contents, "utf8");
      return config;
    },
  ]);
};

export const withFlaggedAutolinking: ConfigPlugin<{ flags: string[] }> = (
  config,
  props
) => {
  const expoPkg = require("expo/package.json");
  const [expoMajorVersion] = expoPkg.version.split(".");
  const extendedProps = {
    ...props,
    expoMajorVersion: parseInt(expoMajorVersion, 10),
  };

  return withFlaggedAutolinkingForAndroid(
    withFlaggedAutolinkingForApple(config, extendedProps),
    extendedProps
  );
};

export function updatePodfileReactNativeAutolinkCallForSDK51(
  contents: string,
  { exclude }: { exclude: string[] }
): string {
  const matchPoint = "origin_autolinking_method.call(config_command)";
  return contents.replace(
    matchPoint,
    `
    # expo-build-flags autolinking override
    config_command = [
      '../node_modules/.bin/build-flags-autolinking',
      '-p', 'ios',
      ${exclude.map((dep) => [`'-x'`, `'${dep}'`].join(", ")).join(", ")}
    ]
    ${matchPoint}
`
  );
}

export function updatePodfileReactNativeAutolinkCallForSDK52(
  contents: string,
  { exclude }: { exclude: string[] }
): string {
  const matchPoint = "config = use_native_modules!(config_command)";
  return contents.replace(
    matchPoint,
    `
    # expo-build-flags autolinking override
    config_command = [
      '../node_modules/.bin/build-flags-autolinking',
      '-p', 'ios',
      ${exclude.map((dep) => [`'-x'`, `'${dep}'`].join(", ")).join(", ")}
    ]
    ${matchPoint}
`
  );
}

export function updatePodfileExpoModulesAutolinkCall(
  contents: string,
  { exclude }: { exclude: string[] }
): string {
  const match = contents.match(/use_expo_modules!(\s*\(([^)]+)\))?/);
  if (!match?.[0]) {
    throw new Error(`Could not find use_expo_modules! call in Podfile`);
  }

  if (!match[0].trim().endsWith("!")) {
    throw new Error(
      `expo-build-flags: Podfile already passes args to use_expo_modules! and transforming this state is not yet supported.`
    );
  }

  return contents.replace(
    match[0],
    `use_expo_modules!({ exclude: ["${exclude.join('","')}"] })`
  );
}

export function updateGradleReactNativeAutolinkCall(
  contents: string,
  { exclude }: { exclude: string[] }
): string {
  const matchPoint = "ex.autolinkLibrariesFromCommand(command)";

  return contents.replace(
    matchPoint,
    `// expo-build-flags autolinking override
    command = [
      './node_modules/.bin/build-flags-autolinking',
      '-p', 'android',
      ${exclude.map((dep) => [`'-x'`, `'${dep}'`].join(", ")).join(", ")}
    ].toList()
    ${matchPoint}
    `
  );
}

export function updateGradleExpoModulesAutolinkCall(
  contents: string,
  { exclude }: { exclude: string[] }
): string {
  const match = contents.match(/useExpoModules\(\)/);
  if (!match?.[0]) {
    throw new Error(`Could not find useExpoModules() call in settings.gradle`);
  }

  if (!match[0].trim().endsWith("()")) {
    throw new Error(
      `expo-build-flags: settings.gradle has an unexpected useExpoModules() call format.`
    );
  }

  return contents.replace(
    match[0],
    `useExpoModules(exclude: ["${exclude.join('","')}"])`
  );
}

export function updateGradleReactNativeAutolinkCallForSDK54(
  contents: string,
  { exclude }: { exclude: string[] }
): string {
  const matchPoint = "ex.autolinkLibrariesFromCommand(expoAutolinking.rnConfigCommand)";
  if (!contents.includes(matchPoint)) {
    throw new Error(
      `expo-build-flags: Could not find ${matchPoint} in settings.gradle`
    );
  }
  return contents.replace(
    matchPoint,
    `// expo-build-flags autolinking override
    ex.autolinkLibrariesFromCommand([
      './node_modules/.bin/build-flags-autolinking',
      '-p', 'android',
      ${exclude.map((dep) => [`'-x'`, `'${dep}'`].join(", ")).join(", ")}
    ].toList())`
  );
}

export function updateGradleExpoModulesAutolinkCallForSDK54(
  contents: string,
  { exclude }: { exclude: string[] }
): string {
  const match = contents.match(/(?:expoAutolinking\.)?useExpoModules\(\)/);
  if (!match?.[0]) {
    throw new Error(`Could not find useExpoModules() call in settings.gradle`);
  }

  return contents.replace(
    match[0],
    `expoAutolinking.exclude = ["${exclude.join('","')}"]\n${match[0]}`
  );
}

let exclude: string[] | null = null;
async function getExclusions(flagOverrides?: string[]) {
  if (Array.isArray(exclude)) {
    return exclude;
  }
  exclude = await readConfigModuleExclusions(flagOverrides);
  return exclude;
}
