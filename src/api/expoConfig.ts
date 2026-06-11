import type { ExpoConfig } from "@expo/config-types";
import { execFile } from "child_process";
import { promisify } from "util";
import { debug } from "./debug";

const execFileAsync = promisify(execFile);

let cached: ExpoConfig | null | undefined;

/**
 * Resolve the project's Expo config by shelling out to `expo config --json`.
 * This evaluates dynamic config (app.config.js/ts) under the current env, so
 * the CLI sees the same resolved bundle identifier the config plugin would at
 * prebuild time. Result is cached for the lifetime of the process.
 *
 * Returns null if the Expo CLI is unavailable or the config can't be read; the
 * caller should treat that as "no config-dependent inversions resolvable".
 */
export const readExpoConfig = async (): Promise<ExpoConfig | null> => {
  if (cached !== undefined) {
    return cached;
  }
  try {
    const { stdout } = await execFileAsync(
      "npx",
      ["expo", "config", "--json"],
      { maxBuffer: 1024 * 1024 * 16 }
    );
    cached = JSON.parse(stdout) as ExpoConfig;
    debug(
      "resolved expo config: ios.bundleIdentifier=%o android.package=%o",
      cached.ios?.bundleIdentifier,
      cached.android?.package
    );
  } catch (e) {
    debug("failed to resolve expo config via `expo config --json`: %o", e);
    cached = null;
  }
  return cached;
};
