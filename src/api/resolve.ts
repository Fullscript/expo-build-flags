import type { ExpoConfig } from "@expo/config-types";
import { FlagMap, Platform } from "./types";
import { hasMatch } from "./globUtil";
import { debug } from "./debug";

export type ResolveContext = {
  /** Resolve for a single platform; undefined = platform-agnostic pass. */
  platform?: Platform;
  /** Resolved Expo config (bundleIdentifier / package); enables bundleId inversion. */
  expoConfig?: ExpoConfig;
  /** Branch name for ota matching; undefined = no branch enablement. */
  branch?: string;
  /** Whether to apply ota.branches enablement against ctx.branch. */
  enableBranchFlags?: boolean;
  /** Explicit enables (CLI +flag / EXPO_BUILD_FLAGS). */
  envEnable?: Set<string>;
  /** Explicit disables (CLI -flag / EXPO_BUILD_FLAGS). Always win. */
  envDisable?: Set<string>;
};

const shouldInvert = (
  invertFor: NonNullable<FlagMap[string]["invertFor"]>,
  ctx: ResolveContext
): boolean => {
  if (invertFor.bundleId && ctx.expoConfig) {
    const iosId = ctx.expoConfig.ios?.bundleIdentifier;
    const androidId = ctx.expoConfig.android?.package;
    const bundleIds = (
      ctx.platform === "ios"
        ? [iosId]
        : ctx.platform === "android"
          ? [androidId]
          : [iosId, androidId]
    ).filter(Boolean) as string[];
    if (
      bundleIds.length &&
      invertFor.bundleId.some((id) => bundleIds.includes(id))
    ) {
      return true;
    }
  }

  if (invertFor.platform && ctx.platform) {
    if (invertFor.platform.includes(ctx.platform)) {
      return true;
    }
  }

  return false;
};

/**
 * The single canonical flag resolver. Deterministic for a given (spec, ctx).
 * Returns a new FlagMap with `value` applied; the input spec is not mutated.
 *
 * Precedence (later steps win):
 *   1. defaults (spec value)
 *   2. branch enablement (ota.branches vs ctx.branch, if enableBranchFlags)
 *   3. inversions (invertFor.bundleId / invertFor.platform)
 *   4. explicit enable (envEnable)
 *   5. explicit disable (envDisable)
 */
export const resolve = (spec: FlagMap, ctx: ResolveContext = {}): FlagMap => {
  const resolved: FlagMap = {};

  for (const [name, config] of Object.entries(spec)) {
    let value = config.value;

    if (
      ctx.enableBranchFlags &&
      ctx.branch &&
      config.ota &&
      Array.isArray(config.ota.branches) &&
      hasMatch(ctx.branch, config.ota.branches)
    ) {
      value = true;
    }

    if (config.invertFor && shouldInvert(config.invertFor, ctx)) {
      value = !value;
    }

    if (ctx.envEnable?.has(name)) {
      value = true;
    }

    if (ctx.envDisable?.has(name)) {
      value = false;
    }

    resolved[name] = { ...config, value };
  }

  const unknownEnable = [...(ctx.envEnable ?? [])].find((f) => !spec[f]);
  if (unknownEnable) {
    throw new Error(`Flag ${unknownEnable} does not exist, could not enable`);
  }
  const unknownDisable = [...(ctx.envDisable ?? [])].find((f) => !spec[f]);
  if (unknownDisable) {
    throw new Error(`Flag ${unknownDisable} does not exist, could not disable`);
  }

  debug(
    "resolved flags (platform=%o branch=%o) -> %o",
    ctx.platform,
    ctx.enableBranchFlags ? ctx.branch : undefined,
    Object.fromEntries(
      Object.entries(resolved).map(([n, c]) => [n, c.value])
    )
  );

  return resolved;
};

/** Names of flags that resolve enabled. */
export const enabledNames = (resolved: FlagMap): string[] =>
  Object.entries(resolved)
    .filter(([, config]) => config.value)
    .map(([name]) => name);

/** Whether two resolved FlagMaps differ in any flag value. */
export const valuesDiffer = (a: FlagMap, b: FlagMap): boolean => {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (a[key]?.value !== b[key]?.value) {
      return true;
    }
  }
  return false;
};

/** Whether any flag in the spec uses a platform-dependent matcher. */
export const hasPlatformInversions = (spec: FlagMap): boolean =>
  Object.values(spec).some((c) => c.invertFor?.platform?.length);

/** Whether any flag in the spec uses a bundleId (resolved-config) matcher. */
export const hasBundleIdInversions = (spec: FlagMap): boolean =>
  Object.values(spec).some((c) => c.invertFor?.bundleId?.length);
