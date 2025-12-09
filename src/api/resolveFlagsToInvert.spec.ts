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
});
