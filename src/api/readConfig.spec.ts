import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import * as fs from "fs/promises";
import { resolveModuleExclusions } from "./readConfig";
import { resolve } from "./resolve";

jest.mock("fs/promises", () => ({
  readFile: jest.fn(() => Promise.resolve()),
}));

const fsActual: any = jest.requireActual("fs/promises");

let yaml: string;

const loadSpec = async () => {
  const YAML = require("yaml");
  const config = YAML.parse(yaml);
  return config.flags;
};

describe("resolveModuleExclusions", () => {
  beforeEach(async () => {
    yaml = await fsActual.readFile("src/api/fixtures/flags.yml", {
      encoding: "utf-8",
    });
    jest.spyOn(fs, "readFile").mockImplementation((path: any) => {
      if (path.endsWith(".git/HEAD")) {
        return "ref: refs/heads/feature-in-dev-build-branch";
      }
      throw new Error(`readFile: path not mocked: ${path}`);
    });
  });

  it("should return modules for flags that resolve false", async () => {
    const resolved = resolve(await loadSpec());
    const exclusions = await resolveModuleExclusions(resolved);
    expect(exclusions).toEqual(["react-native-device-info", "exclude-me"]);
  });

  it("should not exclude modules for flags enabled by override", async () => {
    const resolved = resolve(await loadSpec(), {
      envEnable: new Set(["featureInDevelopment"]),
    });
    const exclusions = await resolveModuleExclusions(resolved);
    expect(exclusions).toEqual([]);
  });
});
