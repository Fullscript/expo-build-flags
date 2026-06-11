import { describe, it, expect } from "@jest/globals";
import {
  resolve,
  enabledNames,
  valuesDiffer,
  hasPlatformInversions,
  hasBundleIdInversions,
} from "./resolve";
import { FlagMap } from "./types";

const spec: FlagMap = {
  base: { value: false, meta: {} },
  defaultOn: { value: true, meta: {} },
  branchFlag: { value: false, meta: {}, ota: { branches: ["feature-branch"] } },
  bundleFlag: {
    value: false,
    meta: {},
    invertFor: { bundleId: ["com.my.app.apple", "com.my.app.android"] },
  },
  iosFlag: { value: false, meta: {}, invertFor: { platform: ["ios"] } },
};

describe("resolve", () => {
  it("applies defaults when no context", () => {
    const r = resolve(spec);
    expect(r.base.value).toBe(false);
    expect(r.defaultOn.value).toBe(true);
  });

  it("does not mutate the input spec", () => {
    resolve(spec, { envEnable: new Set(["base"]) });
    expect(spec.base.value).toBe(false);
  });

  it("enables branch flags only when enableBranchFlags + matching branch", () => {
    expect(resolve(spec, { branch: "feature-branch" }).branchFlag.value).toBe(
      false
    );
    expect(
      resolve(spec, { enableBranchFlags: true, branch: "other" }).branchFlag
        .value
    ).toBe(false);
    expect(
      resolve(spec, { enableBranchFlags: true, branch: "feature-branch" })
        .branchFlag.value
    ).toBe(true);
  });

  it("inverts bundleId flags only on a matching resolved config", () => {
    expect(
      resolve(spec, { expoConfig: { ios: { bundleIdentifier: "com.my.app" } } as any })
        .bundleFlag.value
    ).toBe(false);
    expect(
      resolve(spec, {
        expoConfig: { ios: { bundleIdentifier: "com.my.app.apple" } } as any,
      }).bundleFlag.value
    ).toBe(true);
    expect(
      resolve(spec, {
        expoConfig: { android: { package: "com.my.app.android" } } as any,
      }).bundleFlag.value
    ).toBe(true);
  });

  it("scopes bundleId inversion to the resolving platform", () => {
    const expoConfig = {
      ios: { bundleIdentifier: "com.my.app.dev" },
      android: { package: "com.my.app.android" },
    } as any;
    expect(
      resolve(spec, { platform: "ios", expoConfig }).bundleFlag.value
    ).toBe(false);
    expect(
      resolve(spec, { platform: "android", expoConfig }).bundleFlag.value
    ).toBe(true);
  });

  it("inverts platform flags only for the matching platform", () => {
    expect(resolve(spec, { platform: "android" }).iosFlag.value).toBe(false);
    expect(resolve(spec, { platform: "ios" }).iosFlag.value).toBe(true);
  });

  it("applies env enable then disable, with disable winning", () => {
    expect(resolve(spec, { envEnable: new Set(["base"]) }).base.value).toBe(
      true
    );
    expect(
      resolve(spec, {
        envEnable: new Set(["base"]),
        envDisable: new Set(["base"]),
      }).base.value
    ).toBe(false);
  });

  it("disable beats branch enablement and inversion", () => {
    expect(
      resolve(spec, {
        enableBranchFlags: true,
        branch: "feature-branch",
        envDisable: new Set(["branchFlag"]),
      }).branchFlag.value
    ).toBe(false);
    expect(
      resolve(spec, {
        platform: "ios",
        envDisable: new Set(["iosFlag"]),
      }).iosFlag.value
    ).toBe(false);
  });

  it("throws on enabling/disabling unknown flags", () => {
    expect(() => resolve(spec, { envEnable: new Set(["nope"]) })).toThrow(
      /nope/
    );
    expect(() => resolve(spec, { envDisable: new Set(["nope"]) })).toThrow(
      /nope/
    );
  });
});

describe("helpers", () => {
  it("enabledNames lists only true flags", () => {
    expect(enabledNames(resolve(spec)).sort()).toEqual(["defaultOn"]);
  });

  it("valuesDiffer detects per-platform divergence", () => {
    const ios = resolve(spec, { platform: "ios" });
    const android = resolve(spec, { platform: "android" });
    expect(valuesDiffer(ios, android)).toBe(true);
    expect(valuesDiffer(ios, ios)).toBe(false);
  });

  it("detects matcher presence", () => {
    expect(hasPlatformInversions(spec)).toBe(true);
    expect(hasBundleIdInversions(spec)).toBe(true);
    expect(hasPlatformInversions({ a: { value: false, meta: {} } })).toBe(false);
  });
});
