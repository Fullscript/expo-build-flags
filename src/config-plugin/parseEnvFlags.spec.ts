import { describe, it, expect, afterEach } from "@jest/globals";
import { parseEnvFlags } from "./parseEnvFlags";

describe("parseEnvFlags", () => {
  const original = process.env.EXPO_BUILD_FLAGS;
  afterEach(() => {
    if (original === undefined) {
      delete process.env.EXPO_BUILD_FLAGS;
    } else {
      process.env.EXPO_BUILD_FLAGS = original;
    }
  });

  it("returns empty sets when env var is unset", () => {
    delete process.env.EXPO_BUILD_FLAGS;
    const result = parseEnvFlags();
    expect(result.flagsToEnable).toEqual(new Set());
    expect(result.flagsToDisable).toEqual(new Set());
  });

  it("returns empty sets when env var is empty", () => {
    const result = parseEnvFlags("");
    expect(result.flagsToEnable).toEqual(new Set());
    expect(result.flagsToDisable).toEqual(new Set());
  });

  it("treats bare names as enables (backwards compatible)", () => {
    const result = parseEnvFlags("foo,bar");
    expect(result.flagsToEnable).toEqual(new Set(["foo", "bar"]));
    expect(result.flagsToDisable).toEqual(new Set());
  });

  it("treats +name as enable", () => {
    const result = parseEnvFlags("+foo,+bar");
    expect(result.flagsToEnable).toEqual(new Set(["foo", "bar"]));
    expect(result.flagsToDisable).toEqual(new Set());
  });

  it("treats -name as disable", () => {
    const result = parseEnvFlags("-foo,-bar");
    expect(result.flagsToEnable).toEqual(new Set());
    expect(result.flagsToDisable).toEqual(new Set(["foo", "bar"]));
  });

  it("supports mixed enable and disable entries", () => {
    const result = parseEnvFlags("alpha,+beta,-gamma,delta");
    expect(result.flagsToEnable).toEqual(new Set(["alpha", "beta", "delta"]));
    expect(result.flagsToDisable).toEqual(new Set(["gamma"]));
  });

  it("trims whitespace around entries and after prefix", () => {
    const result = parseEnvFlags(" foo , + bar , - baz ");
    expect(result.flagsToEnable).toEqual(new Set(["foo", "bar"]));
    expect(result.flagsToDisable).toEqual(new Set(["baz"]));
  });

  it("ignores empty entries and bare prefixes", () => {
    const result = parseEnvFlags(",,foo,,+,-,bar,");
    expect(result.flagsToEnable).toEqual(new Set(["foo", "bar"]));
    expect(result.flagsToDisable).toEqual(new Set());
  });

  it("places a flag in both sets when both prefixes are used (disable wins downstream)", () => {
    const result = parseEnvFlags("+foo,-foo");
    expect(result.flagsToEnable).toEqual(new Set(["foo"]));
    expect(result.flagsToDisable).toEqual(new Set(["foo"]));
  });

  it("reads from process.env when no argument is passed", () => {
    process.env.EXPO_BUILD_FLAGS = "alpha,-beta";
    const result = parseEnvFlags();
    expect(result.flagsToEnable).toEqual(new Set(["alpha"]));
    expect(result.flagsToDisable).toEqual(new Set(["beta"]));
  });
});
