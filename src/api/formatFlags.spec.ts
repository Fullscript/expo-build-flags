import { describe, it, expect } from "@jest/globals";
import YAML from "yaml";
import { formatFlagsYaml } from "./formatFlags";

describe("formatFlagsYaml", () => {
  it("sorts the keys of the flags object alphabetically", () => {
    const input = [
      "mergePath: buildFlags.ts",
      "flags:",
      "  zebra:",
      "    value: true",
      "  alpha:",
      "    value: false",
      "  mango:",
      "    value: true",
      "",
    ].join("\n");

    const out = YAML.parse(formatFlagsYaml(input));
    expect(Object.keys(out.flags)).toEqual(["alpha", "mango", "zebra"]);
  });

  it("leaves top-level key order untouched", () => {
    const input = ["flags:", "  b:", "    value: true", "mergePath: x.ts", ""].join(
      "\n"
    );
    const out = formatFlagsYaml(input);
    expect(out.indexOf("flags:")).toBeLessThan(out.indexOf("mergePath:"));
  });

  it("preserves comments and quoting", () => {
    const input = [
      "mergePath: buildFlags.ts",
      "flags:",
      "  zebra:",
      "    value: true # keep me",
      "  alpha:",
      '    value: false',
      "",
    ].join("\n");

    const out = formatFlagsYaml(input);
    expect(out).toContain("# keep me");
    expect(out.indexOf("alpha:")).toBeLessThan(out.indexOf("zebra:"));
  });

  it("is idempotent", () => {
    const input = [
      "flags:",
      "  b:",
      "    value: true",
      "  a:",
      "    value: false",
      "",
    ].join("\n");
    const once = formatFlagsYaml(input);
    expect(formatFlagsYaml(once)).toBe(once);
  });

  it("throws on invalid yaml", () => {
    expect(() => formatFlagsYaml("flags:\n  a: : :\n")).toThrow();
  });
});
