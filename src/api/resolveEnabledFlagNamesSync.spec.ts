import { jest, describe, it, expect, afterEach } from "@jest/globals";
import {
  resolveEnabledFlagNames,
  resolveEnabledFlagNamesSync,
} from "./generateOverrides";

const fixture = {
  mergePath: "src/buildFlags.ts",
  flags: {
    alpha: { value: true },
    beta: { value: false },
    gamma: { value: false },
  },
};

jest.mock("./readConfig", () => ({
  readConfig: () => Promise.resolve(fixture),
  readConfigSync: () => fixture,
}));

describe("resolveEnabledFlagNames env parity", () => {
  afterEach(() => {
    delete process.env.EXPO_BUILD_FLAGS;
  });

  describe.each([
    ["sync", (opts?: any) => resolveEnabledFlagNamesSync(opts)],
    ["async", (opts?: any) => resolveEnabledFlagNames(opts)],
  ])("%s", (_label, resolveNames) => {
    it("returns names of flags enabled by default", async () => {
      expect(await resolveNames()).toEqual(["alpha"]);
    });

    it("picks up EXPO_BUILD_FLAGS enables by default", async () => {
      process.env.EXPO_BUILD_FLAGS = "beta";
      expect((await resolveNames()).sort()).toEqual(["alpha", "beta"]);
    });

    it("picks up EXPO_BUILD_FLAGS disables by default", async () => {
      process.env.EXPO_BUILD_FLAGS = "-alpha, +gamma";
      expect(await resolveNames()).toEqual(["gamma"]);
    });

    it("explicit options override the env var", async () => {
      process.env.EXPO_BUILD_FLAGS = "beta";
      expect(
        (await resolveNames({ flagsToEnable: new Set(["gamma"]) })).sort()
      ).toEqual(["alpha", "gamma"]);
    });
  });
});
