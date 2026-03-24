import { writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import { FlagMap } from "./types";
import { resolve } from "path";
import { printAsTs } from "./tsPrinter";
import { getCIBranch } from "./ciHelpers";
import { hasMatch } from "./globUtil";

export const platformPaths = (basePath: string) => {
  const ext = basePath.endsWith(".ts") ? ".ts" : ".json";
  const stem = basePath.slice(0, -ext.length);
  return {
    ios: `${stem}.ios${ext}`,
    android: `${stem}.android${ext}`,
  };
};

const cleanupStaleFiles = async (
  basePath: string,
  mode: "single" | "platform"
) => {
  const paths = platformPaths(basePath);
  const toDelete =
    mode === "single"
      ? [paths.ios, paths.android]
      : [basePath];

  for (const p of toDelete) {
    const resolved = resolve(p);
    if (existsSync(resolved)) {
      await unlink(resolved);
    }
  }
};

export class BuildFlags {
  flags: FlagMap;

  constructor(defaultFlags: FlagMap) {
    this.flags = defaultFlags;
  }

  enableBranchFlags() {
    const branch = getCIBranch();
    if (!branch) {
      return;
    }

    const branchFlags = Object.keys(this.flags).filter((flag) => {
      const ota = this.flags[flag].ota;
      if (
        ota &&
        Array.isArray(ota.branches) &&
        hasMatch(branch, ota.branches)
      ) {
        return true;
      }
    });

    if (branchFlags.length === 0) {
      return;
    }

    this.enable(new Set(branchFlags));
  }

  enable(enables: Set<string>) {
    enables.forEach((enable) => {
      if (!this.flags[enable]) {
        throw new Error(`Flag ${enable} does not exist, could not enable`);
      }
      this.flags[enable].value = true;
    });
  }

  disable(disables: Set<string>) {
    disables.forEach((disable) => {
      if (!this.flags[disable]) {
        throw new Error(`Flag ${disable} does not exist, could not disable`);
      }
      this.flags[disable].value = false;
    });
  }

  async save(path: string) {
    await cleanupStaleFiles(path, "single");

    if (path.endsWith(".json")) {
      const flags = JSON.stringify(this.flags, null, 2);
      await writeFile(resolve(path), flags);
      return;
    }

    if (path.endsWith(".ts")) {
      const ts = printAsTs(this.flags);
      await writeFile(resolve(path), ts);
      return;
    }

    throw new Error(
      "Invalid file extension in flags file for mergePath: expected .json or .ts"
    );
  }

  async savePlatformSpecific(
    basePath: string,
    iosFlags: FlagMap,
    androidFlags: FlagMap
  ) {
    await cleanupStaleFiles(basePath, "platform");

    const paths = platformPaths(basePath);

    if (basePath.endsWith(".ts")) {
      await writeFile(resolve(paths.ios), printAsTs(iosFlags));
      await writeFile(resolve(paths.android), printAsTs(androidFlags));
      return;
    }

    if (basePath.endsWith(".json")) {
      await writeFile(resolve(paths.ios), JSON.stringify(iosFlags, null, 2));
      await writeFile(
        resolve(paths.android),
        JSON.stringify(androidFlags, null, 2)
      );
      return;
    }

    throw new Error(
      "Invalid file extension in flags file for mergePath: expected .json or .ts"
    );
  }
}
