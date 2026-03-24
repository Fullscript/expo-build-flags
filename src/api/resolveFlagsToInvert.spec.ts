import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import * as fs from "fs/promises";
import { resolveFlagsToInvert } from "./resolveFlagsToInvert";

jest.mock("fs/promises", () => ({
  readFile: jest.fn(() => Promise.resolve()),
}));

const fsActual: any = jest.requireActual("fs/promises");

describe("resolveFlagsToInvert", () => {
  beforeEach(async () => {
    const yaml = await fsActual.readFile("src/api/fixtures/flags.yml", {
      encoding: "utf-8",
    });
    jest.spyOn(fs, "readFile").mockImplementation((path: any) => {
      if (path.endsWith("flags.yml")) {
        return yaml;
      }
      throw new Error(`readFile: path not mocked: ${path}`);
    });
  });

  it("should not invert with no bundle ID match", async () => {
    const result = await resolveFlagsToInvert({
      ios: { bundleIdentifier: "com.my.app" },
    } as any);

    expect(result.flagsToEnable.has("invertableFeature")).toBe(false);
  });

  it("should match against iOS config bundleId", async () => {
    const result = await resolveFlagsToInvert({
      ios: { bundleIdentifier: "com.my.app.apple" },
      android: { package: "com.my.app" },
    } as any);

    expect(result.flagsToEnable.has("invertableFeature")).toBe(true);
  });

  it("should match against Android config package", async () => {
    const result = await resolveFlagsToInvert({
      ios: { bundleIdentifier: "com.my.app" },
      android: { package: "com.my.app.android" },
    } as any);

    expect(result.flagsToEnable.has("invertableFeature")).toBe(true);
  });

  describe("platform inversion", () => {
    it("should invert when platform matches", async () => {
      const result = await resolveFlagsToInvert(undefined, "ios");

      expect(result.flagsToEnable.has("platformInvertableFeature")).toBe(true);
    });

    it("should not invert when platform does not match", async () => {
      const result = await resolveFlagsToInvert(undefined, "android");

      expect(result.flagsToEnable.has("platformInvertableFeature")).toBe(false);
    });

    it("should not invert when no platform is provided", async () => {
      const result = await resolveFlagsToInvert();

      expect(result.flagsToEnable.has("platformInvertableFeature")).toBe(false);
    });
  });

  describe("OR composition (bundleId + platform)", () => {
    it("should invert when bundleId matches but platform does not", async () => {
      const result = await resolveFlagsToInvert(
        { ios: { bundleIdentifier: "com.my.app.special" } } as any,
        "ios"
      );

      expect(result.flagsToEnable.has("combinedInvertableFeature")).toBe(true);
    });

    it("should invert when platform matches but bundleId does not", async () => {
      const result = await resolveFlagsToInvert(
        { ios: { bundleIdentifier: "com.other.app" } } as any,
        "android"
      );

      expect(result.flagsToEnable.has("combinedInvertableFeature")).toBe(true);
    });

    it("should invert when both bundleId and platform match", async () => {
      const result = await resolveFlagsToInvert(
        { android: { package: "com.my.app.special" } } as any,
        "android"
      );

      expect(result.flagsToEnable.has("combinedInvertableFeature")).toBe(true);
    });

    it("should not invert when neither bundleId nor platform matches", async () => {
      const result = await resolveFlagsToInvert(
        { ios: { bundleIdentifier: "com.other.app" } } as any,
        "ios"
      );

      expect(result.flagsToEnable.has("combinedInvertableFeature")).toBe(false);
    });
  });
});
