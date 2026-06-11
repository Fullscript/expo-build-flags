import type { ExpoConfig } from "@expo/config-types";
import { readConfig } from "./readConfig";
import { getCIBranch } from "./ciHelpers";
import { resolve, enabledNames, ResolveContext } from "./resolve";
import { saveFlags, savePlatformFlags } from "./writeFlags";
import { FlagMap, Platform } from "./types";

type OverrideOptions = {
  flagsToEnable?: Set<string>;
  flagsToDisable?: Set<string>;
  enableBranchFlags?: boolean;
  expoConfig?: ExpoConfig;
};

const baseContext = (
  opts: OverrideOptions
): Omit<ResolveContext, "platform"> => ({
  expoConfig: opts.expoConfig,
  branch: opts.enableBranchFlags ? getCIBranch() : undefined,
  enableBranchFlags: opts.enableBranchFlags,
  envEnable: opts.flagsToEnable,
  envDisable: opts.flagsToDisable,
});

/**
 * Resolve the runtime flags from flags.yml and write the runtime module(s).
 * Writes platform-specific files (.ios.ts / .android.ts) only when a flag
 * resolves differently across platforms; otherwise a single shared module.
 * Called by the CLI and the config plugin so both produce identical output.
 */
export const generateOverrides = async (opts: OverrideOptions = {}) => {
  const { mergePath, flags: spec } = await readConfig();
  const ctx = baseContext(opts);

  const ios = resolve(spec, { ...ctx, platform: "ios" });
  const android = resolve(spec, { ...ctx, platform: "android" });

  await savePlatformFlags(mergePath, ios, android);
};

/** Resolve and write without a platform axis (used where platform is irrelevant). */
export const generateSharedOverrides = async (opts: OverrideOptions = {}) => {
  const { mergePath, flags: spec } = await readConfig();
  const resolved = resolve(spec, baseContext(opts));
  await saveFlags(mergePath, resolved);
};

/** Names of flags that resolve enabled for a given platform/context. */
export const resolveEnabledFlagNames = async ({
  platform,
  ...opts
}: OverrideOptions & { platform?: Platform } = {}): Promise<string[]> => {
  const { flags: spec } = await readConfig();
  const resolved = resolve(spec, { ...baseContext(opts), platform });
  return enabledNames(resolved);
};

/** Resolve the full FlagMap for a platform (used by autolinking exclusions). */
export const resolveFlags = async ({
  platform,
  ...opts
}: OverrideOptions & { platform?: Platform } = {}): Promise<FlagMap> => {
  const { flags: spec } = await readConfig();
  return resolve(spec, { ...baseContext(opts), platform });
};
