import fs from "fs";
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import {
  updateGradleReactNativeAutolinkCall,
  updateGradleReactNativeAutolinkCallForSDK54,
  updateGradleExpoModulesAutolinkCall,
  updateGradleExpoModulesAutolinkCallForSDK54,
  updatePodfileReactNativeAutolinkCallForSDK51,
  updatePodfileExpoModulesAutolinkCall,
} from "./withFlaggedAutolinking";

describe("withFlaggedAutolinking", () => {
  describe("updatePodfileExpoModulesAutolinkCall", () => {
    const podfileContents = fs.readFileSync(
      "src/config-plugin/fixtures/Podfile",
      "utf8"
    );

    it("should replace use_expo_modules! with exclude options in call", () => {
      const updatedContents = updatePodfileExpoModulesAutolinkCall(
        podfileContents,
        {
          exclude: ["react-native-device-info"],
        }
      );
      const updatedLine = updatedContents
        .split("\n")
        .find((line) =>
          line
            .trim()
            .startsWith(
              'use_expo_modules!({ exclude: ["react-native-device-info"] })'
            )
        );

      expect(updatedLine).toBeTruthy();
    });
  });

  describe("updateGradleReactNativeAutolinkCall", () => {
    const gradleSettingsContents = fs.readFileSync(
      "src/config-plugin/fixtures/settings.gradle",
      "utf8"
    );

    it("should override config command before passing to RN autolinking call", () => {
      const updatedContents = updateGradleReactNativeAutolinkCall(
        gradleSettingsContents,
        {
          exclude: ["react-native-device-info", "some-other-module"],
        }
      );
      const updatedLineIndex = updatedContents
        .split("\n")
        .findIndex((line) =>
          line.trim().startsWith("// expo-build-flags autolinking override")
        );

      expect(updatedLineIndex).toBeGreaterThan(-1);

      const snapshotLineOffset = updatedLineIndex + 1;
      const linesToSnapshot = 5;
      const matchLines = updatedContents
        .split("\n")
        .slice(snapshotLineOffset, snapshotLineOffset + linesToSnapshot)
        .join("\n");
      expect(matchLines).toMatchInlineSnapshot(`
"    command = [
      './node_modules/.bin/build-flags-autolinking',
      '-p', 'android',
      '-x', 'react-native-device-info', '-x', 'some-other-module'
    ].toList()"
`);
    });
  });

  describe("updateGradleExpoModulesAutolinkCall", () => {
    const gradleSettingsContents = fs.readFileSync(
      "src/config-plugin/fixtures/settings.gradle",
      "utf8"
    );

    it("should replace useExpoModules() with exclude options in call", () => {
      const updatedContents = updateGradleExpoModulesAutolinkCall(
        gradleSettingsContents,
        {
          exclude: ["react-native-device-info", "some-other-module"],
        }
      );
      const lines = updatedContents.split("\n");
      const updatedLine = lines.find((line) =>
        line.trim().startsWith("useExpoModules")
      );

      expect(updatedLine).toBe(
        `useExpoModules(exclude: ["react-native-device-info","some-other-module"])`
      );
    });
  });

  describe("updateGradleReactNativeAutolinkCallForSDK54", () => {
    const gradleSettingsContents = fs.readFileSync(
      "src/config-plugin/fixtures/settings.gradle.sdk54",
      "utf8"
    );

    it("should replace expoAutolinking.rnConfigCommand with build-flags command", () => {
      const updatedContents = updateGradleReactNativeAutolinkCallForSDK54(
        gradleSettingsContents,
        {
          exclude: ["react-native-device-info", "react-native-reanimated"],
        }
      );

      expect(updatedContents).not.toContain("expoAutolinking.rnConfigCommand");

      const updatedLineIndex = updatedContents
        .split("\n")
        .findIndex((line) =>
          line.trim().startsWith("// expo-build-flags autolinking override")
        );
      expect(updatedLineIndex).toBeGreaterThan(-1);

      const snapshotLineOffset = updatedLineIndex + 1;
      const linesToSnapshot = 5;
      const matchLines = updatedContents
        .split("\n")
        .slice(snapshotLineOffset, snapshotLineOffset + linesToSnapshot)
        .join("\n");
      expect(matchLines).toMatchInlineSnapshot(`
"    ex.autolinkLibrariesFromCommand([
      './node_modules/.bin/build-flags-autolinking',
      '-p', 'android',
      '-x', 'react-native-device-info', '-x', 'react-native-reanimated'
    ].toList())"
`);
    });
  });

  describe("updateGradleExpoModulesAutolinkCallForSDK54", () => {
    const gradleSettingsContents = fs.readFileSync(
      "src/config-plugin/fixtures/settings.gradle.sdk54",
      "utf8"
    );

    it("should set expoAutolinking.exclude before useExpoModules()", () => {
      const updatedContents = updateGradleExpoModulesAutolinkCallForSDK54(
        gradleSettingsContents,
        {
          exclude: ["react-native-device-info", "some-other-module"],
        }
      );
      const lines = updatedContents.split("\n");
      const excludeLineIndex = lines.findIndex((line) =>
        line.trim().startsWith("expoAutolinking.exclude")
      );
      const useExpoModulesLineIndex = lines.findIndex((line) =>
        line.trim().endsWith("useExpoModules()")
      );

      expect(excludeLineIndex).toBeGreaterThan(-1);
      expect(useExpoModulesLineIndex).toBe(excludeLineIndex + 1);
      expect(lines[excludeLineIndex]).toBe(
        `expoAutolinking.exclude = ["react-native-device-info","some-other-module"]`
      );
    });
  });

  describe("updatePodfileReactNativeAutolinkCallForSDK51", () => {
    const podfileContents = fs.readFileSync(
      "src/config-plugin/fixtures/Podfile",
      "utf8"
    );

    it("should replace origin_autolinking_method.call(config_command) with custom autolinking command", () => {
      const updatedContents = updatePodfileReactNativeAutolinkCallForSDK51(
        podfileContents,
        {
          exclude: ["react-native-device-info", "react-native-reanimated"],
        }
      );
      const updatedLineIndex = updatedContents
        .split("\n")
        .findIndex((line) =>
          line.trim().startsWith("# expo-build-flags autolinking override")
        );

      expect(updatedLineIndex).toBeGreaterThan(-1);

      const snapshotLineOffset = updatedLineIndex + 1;
      const linesToSnapshot = 5;
      const matchLines = updatedContents
        .split("\n")
        .slice(snapshotLineOffset, snapshotLineOffset + linesToSnapshot)
        .join("\n");
      expect(matchLines).toMatchInlineSnapshot(`
"    config_command = [
      '../node_modules/.bin/build-flags-autolinking',
      '-p', 'ios',
      '-x', 'react-native-device-info', '-x', 'react-native-reanimated'
    ]"
`);
    });
  });
});
