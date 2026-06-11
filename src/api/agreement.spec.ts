import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import * as fs from "fs/promises";
import { resolve, enabledNames } from "./resolve";
import { resolveEnabledFlagNames, resolveFlags } from "./generateOverrides";
import { FlagMap } from "./types";

jest.mock("fs/promises", () => ({
  readFile: jest.fn(),
}));

// A spec exercising every input axis: defaults, bundleId + platform inversion.
const specYaml = `
mergePath: "constants/buildFlags.ts"
flags:
  base:
    value: true
  bundleScoped:
    value: false
    invertFor:
      bundleId:
        - com.my.app.apple
  iosOnly:
    value: false
    invertFor:
      platform:
        - ios
`;

const parseSpec = (): FlagMap => {
  const YAML = require("yaml");
  return YAML.parse(specYaml).flags;
};

const expoConfig = {
  ios: { bundleIdentifier: "com.my.app.apple" },
  android: { package: "com.my.app" },
} as any;

describe("CLI <-> config-plugin resolution agreement", () => {
  beforeEach(() => {
    jest.spyOn(fs, "readFile").mockImplementation((path: any) => {
      if (path.endsWith("flags.yml")) {
        return Promise.resolve(specYaml) as any;
      }
      throw new Error(`readFile: path not mocked: ${path}`);
    });
  });

  it("plugin native path agrees with the resolved FlagMap per platform", async () => {
    for (const platform of ["ios", "android"] as const) {
      // Plugin native side-effect path (manifest/plist) uses resolveEnabledFlagNames.
      const nativeNames = await resolveEnabledFlagNames({
        expoConfig,
        platform,
      });
      // CLI/bundle path resolves the same FlagMap and the babel/runtime read it.
      const bundleMap = await resolveFlags({ expoConfig, platform });

      expect(nativeNames.sort()).toEqual(enabledNames(bundleMap).sort());
    }
  });

  it("produces the documented per-platform values for this spec", async () => {
    const ios = resolve(parseSpec(), { expoConfig, platform: "ios" });
    const android = resolve(parseSpec(), { expoConfig, platform: "android" });

    // base default-on everywhere; bundleScoped inverted by matching apple id on
    // both platform passes (bundleId match is platform-agnostic); iosOnly only on ios.
    expect(enabledNames(ios).sort()).toEqual(
      ["base", "bundleScoped", "iosOnly"].sort()
    );
    expect(enabledNames(android).sort()).toEqual(
      ["base", "bundleScoped"].sort()
    );
  });
});
