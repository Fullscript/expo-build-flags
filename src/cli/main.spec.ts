import { describe, it, expect } from "@jest/globals";
import { getOptionValue, parseArgs } from "./main";

describe("getOptionValue", () => {
  it("should return the value after the option", () => {
    const args = ["yarn", "build-flags", "--skip-if-env", "EAS_BUILD"];
    expect(getOptionValue(args, "--skip-if-env")).toBe("EAS_BUILD");
  });

  it("should return undefined if option is not present", () => {
    const args = ["yarn", "build-flags", "override", "+flag"];
    expect(getOptionValue(args, "--skip-if-env")).toBeUndefined();
  });

  it("should return undefined if option is last argument (no value)", () => {
    const args = ["yarn", "build-flags","+flag", "--skip-if-env"];
    expect(getOptionValue(args, "--skip-if-env")).toBeUndefined();
  });
});

describe("parseArgs", () => {
  describe("command parsing", () => {
    it("should parse override command", () => {
      const args = ["yarn", "build-flags", "override"];
      const result = parseArgs(args);
      expect(result.command).toBe("override");
    });

    it("should parse init command", () => {
      const args = ["yarn", "build-flags", "init"];
      const result = parseArgs(args);
      expect(result.command).toBe("init");
    });

    it("should parse ota-override command", () => {
      const args = ["yarn", "build-flags", "ota-override"];
      const result = parseArgs(args);
      expect(result.command).toBe("ota-override");
    });
  });

  describe("flag parsing", () => {
    it("should parse flags to enable with + prefix", () => {
      const args = ["yarn", "build-flags", "override", "+feature1", "+feature2"];
      const result = parseArgs(args);
      expect(result.flagsToEnable).toEqual(new Set(["feature1", "feature2"]));
    });

    it("should parse flags to disable with - prefix", () => {
      const args = ["yarn", "build-flags", "override", "-feature1", "-feature2"];
      const result = parseArgs(args);
      expect(result.flagsToDisable).toEqual(new Set(["feature1", "feature2"]));
    });

    it("should parse mixed enable and disable flags", () => {
      const args = [
        "yarn",
        "build-flags",
        "override",
        "+enableThis",
        "-disableThis",
      ];
      const result = parseArgs(args);
      expect(result.flagsToEnable).toEqual(new Set(["enableThis"]));
      expect(result.flagsToDisable).toEqual(new Set(["disableThis"]));
    });
  });

  describe("--skip-if-env option", () => {
    it("should extract skipIfEnv when option comes after command", () => {
      const args = [
        "yarn",
        "build-flags",
        "override",
        "--skip-if-env",
        "EAS_BUILD",
      ];
      const result = parseArgs(args);
      expect(result.skipIfEnv).toBe("EAS_BUILD");
      expect(result.command).toBe("override");
    });

    it("should handle flags alongside --skip-if-env", () => {
      const args = [
        "yarn",
        "build-flags",
        "override",
        "+feature",
        "--skip-if-env",
        "CI",
        "-other",
      ];
      const result = parseArgs(args);
      expect(result.command).toBe("override");
      expect(result.skipIfEnv).toBe("CI");
      expect(result.flagsToEnable).toEqual(new Set(["feature"]));
      expect(result.flagsToDisable).toEqual(new Set(["other"]));
    });

    it("should return undefined skipIfEnv when option is not provided", () => {
      const args = ["yarn", "build-flags", "override", "+flag"];
      const result = parseArgs(args);
      expect(result.skipIfEnv).toBeUndefined();
    });
  });
});

