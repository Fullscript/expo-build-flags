import { describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { saveFlags, savePlatformFlags } from "./writeFlags";
import { FlagMap } from "./types";

const flags: FlagMap = {
  secretFeature: { value: true, meta: {} },
  newFeature: { value: false, meta: {} },
};

let workDir: string;
let prevCwd: string;

beforeEach(() => {
  prevCwd = process.cwd();
  workDir = mkdtempSync(join(tmpdir(), "write-flags-"));
  process.chdir(workDir);
});

afterEach(() => {
  process.chdir(prevCwd);
  rmSync(workDir, { recursive: true, force: true });
});

describe("saveFlags", () => {
  it("creates the parent directory when the mergePath folder does not exist", async () => {
    await saveFlags("constants/buildFlags.ts", flags);

    expect(existsSync("constants/buildFlags.ts")).toBe(true);
    expect(readFileSync("constants/buildFlags.ts", "utf8")).toContain(
      "secretFeature"
    );
  });

  it("creates nested parent directories", async () => {
    await saveFlags("src/generated/flags/buildFlags.ts", flags);

    expect(existsSync("src/generated/flags/buildFlags.ts")).toBe(true);
  });
});

describe("savePlatformFlags", () => {
  it("creates the parent directory for platform-specific modules", async () => {
    await savePlatformFlags(
      "constants/buildFlags.ts",
      { feature: { value: true, meta: {} } },
      { feature: { value: false, meta: {} } }
    );

    expect(existsSync("constants/buildFlags.ios.ts")).toBe(true);
    expect(existsSync("constants/buildFlags.android.ts")).toBe(true);
  });
});
