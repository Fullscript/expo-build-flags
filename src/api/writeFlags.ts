import { writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { resolve as resolvePath, dirname } from "path";
import { FlagMap } from "./types";
import { printAsTs } from "./tsPrinter";
import { valuesDiffer } from "./resolve";
import { debug } from "./debug";

export const platformPaths = (basePath: string) => {
  const ext = basePath.endsWith(".ts") ? ".ts" : ".json";
  const stem = basePath.slice(0, -ext.length);
  return {
    ios: `${stem}.ios${ext}`,
    android: `${stem}.android${ext}`,
  };
};

const writeOne = async (path: string, flags: FlagMap) => {
  const dest = resolvePath(path);
  await mkdir(dirname(dest), { recursive: true });
  if (path.endsWith(".ts")) {
    await writeFile(dest, printAsTs(flags));
    return;
  }
  if (path.endsWith(".json")) {
    await writeFile(dest, JSON.stringify(flags, null, 2));
    return;
  }
  throw new Error(
    "Invalid file extension in flags file for mergePath: expected .json or .ts"
  );
};

const cleanupStale = async (paths: string[]) => {
  for (const path of paths) {
    const dest = resolvePath(path);
    if (existsSync(dest)) {
      debug("removing stale flags file %s", dest);
      await unlink(dest);
    }
  }
};

/** Write a single platform-agnostic runtime module; clean up any stale platform siblings. */
export const saveFlags = async (basePath: string, flags: FlagMap) => {
  const paths = platformPaths(basePath);
  await cleanupStale([paths.ios, paths.android]);
  debug("writing resolved flags to %s", resolvePath(basePath));
  await writeOne(basePath, flags);
};

/**
 * Write platform-specific modules only when the resolved values differ between
 * platforms; otherwise write a single shared module. Cleans up whichever form
 * is now stale so consumers never read leftover files.
 */
export const savePlatformFlags = async (
  basePath: string,
  ios: FlagMap,
  android: FlagMap
) => {
  const paths = platformPaths(basePath);

  if (!valuesDiffer(ios, android)) {
    await cleanupStale([paths.ios, paths.android]);
    debug("writing shared resolved flags to %s", resolvePath(basePath));
    await writeOne(basePath, ios);
    return;
  }

  await cleanupStale([basePath]);
  debug(
    "writing platform-specific resolved flags to %s / %s",
    resolvePath(paths.ios),
    resolvePath(paths.android)
  );
  await writeOne(paths.ios, ios);
  await writeOne(paths.android, android);
};
