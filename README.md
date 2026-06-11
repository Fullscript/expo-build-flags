# expo-build-flags

A module to make feature-flagging easier for expo projects.

_This module is in active development and is not stable or well documented yet._

## Getting Started

`yarn add expo-build-flags`

Add a flags file to the root of your repo in the form of [the test example](test/integration/default-flags.yml), or run `yarn build-flags init`.

Run `yarn build-flags override +secretFeature -newFeature` sometime before your bundle server or build start to generate the runtime typescript module. This path is defined by `mergePath` and you should add it to your project gitignore.

The arguments after the override command are the flags you want to `+` enable or `-` disable. No comparison with the default value is done, so if it's already enabled and you `+enable` it, it's a no-op.

You can run `yarn build-flags ota-override` instead of "override" to do the same but also consider the branch name in two supported CI environments: Github and Gitlab. Use the `ota.branches` array in the flags.yml to setup that matching and branch-based enablement.

### Resolution model

Both the CLI and the config plugin resolve flag values through one canonical
function with a fixed precedence (later steps win):

1. defaults (the `value` in flags.yml)
2. branch enablement (`ota.branches`, only with `ota-override` / in CI)
3. inversions (`invertFor.bundleId` / `invertFor.platform`)
4. explicit enable (`+flag` / `EXPO_BUILD_FLAGS`)
5. explicit disable (`-flag` / `EXPO_BUILD_FLAGS`) — disable always wins

When a flag's `invertFor` uses `bundleId`, the CLI resolves your project's Expo
config (via `expo config --json`) so it sees the same — possibly dynamically
derived — bundle identifier the config plugin sees at prebuild. This subprocess
only runs when the spec actually contains a `bundleId` matcher.

### Set Flags in CI & for Static Builds

To set flags for EAS builds, set the `EXPO_BUILD_FLAGS` environment variable in `eas.json` for your profile. This value will be available to the config plugin at build time in EAS when you add it to your `app.json` plugins array:

```diff
{
  "expo": {
+    "plugins": ["expo-build-flags"]
  }
}
```

Using the `EXPO_BUILD_FLAGS` environment variable, the config plugin will:

- add a `<meta-data android:name="EXBuildFlags" />` tag to your AndroidManifest.xml
- add a `EXBuildFlags` array to your Info.plist
- generate the runtime build flags module for your javascript bundle

The variable value is a comma-separated list of entries using the same `+`/`-` convention as the `build-flags override` CLI:

- `flagName` or `+flagName` enables a flag.
- `-flagName` disables a flag (useful for forcing a default-`true` flag to `false` for a given build).

For example, `EXPO_BUILD_FLAGS=newFeature,secretFeature,-legacyDashboard` enables `newFeature` and `secretFeature` and disables `legacyDashboard` for that build, regardless of the defaults committed to `flags.yml`. If the same flag appears with both prefixes, the disable wins.

### Enable Tree Shaking

To benefit from tree shaking, add the babel plugin to your project's babel config:

```diff
{
  presets: ["babel-preset-expo"],
  plugins: [
+    ["expo-build-flags/babel-plugin", { flagsModule: "./constants/buildFlags.ts" }],
  ],
}
```

The `flagsModule` path must match the runtime `mergePath` in your committed flags.yml file. This plugin replaces the `BuildFlags` imports with the literal boolean values which allows the build pipeline to strip unreachable paths.

### Flagged Autolinking (for RN >=75)

If your feature relies on native module behaviour, you may want to avoid linking that module if the build flag is off. To do so, specify the absolute name or relative path to the module in the base definition for your flag:

Example for flags.yml definition:

```yaml
flags:
  featureWithNativeStuff:
    value: false
    modules:
      - react-native-device-info
```

In the above example, `react-native-device-info` would be excluded from autolinking. If you want to allow builds to occur on a specific branch, you can specify it:

```yaml
modules:
  - react-native-device-info:
      branch: some-branch-with-build
```

In order to enable this you need to pass `flaggedAutolinking: true` as an option to the expo config plugin.

Locally-referenced modules aren't currently supported (until [this 'exclude' exclusion](https://github.com/expo/expo/blob/24d5ae5f288013df19ac09a3406c6a507d781ddb/packages/expo-modules-autolinking/src/autolinking/findModules.ts#L52) can be overridden).

### Invert flag value with condition

You can invert the default flag value set in flags.yml by specifying a matcher with `invertFor`, example:

```yaml
flags:
  featureOnForSpecificBundleId:
    value: false
    invertFor:
      bundleId:
        - com.example.app.special
```

With the preceding config and the expo config-plugin installed, the `featureOnForSpecificBundleId` flag is true for native builds that have the matching bundleId.

You can also invert based on the platform being built:

```yaml
flags:
  iosOnlyFeature:
    value: false
    invertFor:
      platform:
        - ios
```

If both `bundleId` and `platform` are specified, the inversion fires when
**either** matches.

When a `platform` matcher causes a flag to resolve differently across iOS and
Android, the runtime module is emitted per platform as `<mergePath>.ios.ts` and
`<mergePath>.android.ts` instead of the single `mergePath` file (the stale form
is cleaned up automatically). The babel plugin selects the correct file for the
platform being compiled; if you import the module directly at runtime, Metro's
platform resolution picks it up. When no flag diverges across platforms, a
single shared module is written as before.

Unlike before, both the CLI and the config plugin apply `invertFor` — the CLI
resolves the Expo config when a `bundleId` matcher is present so its output
agrees with the plugin's.

## Goals

- [x] allow defining a base set of flags that are available at runtime in one place
- [x] allow for overriding a flag's value locally during development (without having to change the default value committed to source control)
- [x] allow for running OTA updates with the flag on for specific CI branches
- [x] allow for overriding a flag's value for any native build for one-off testing
- [x] allow flag values to resolve per-platform (iOS vs Android) via `invertFor.platform`
- [x] unify CLI and config-plugin resolution so their core flag output always agrees
- [x] allow for referencing flag values in JS
- [ ] allow for referencing flag values from native code on iOS or Android
- [x] allow for tree-shaking of the JS bundle and dead code path elimination
- [x] allow for typescript to see the specific flags available
- [x] handle autolinking exclusions for react-native modules
- [ ] add metro resolver w/ proxy to surface better flagged autolinking error messages
- [x] add android integration spec for flagged autolinking
- [ ] cleanup flags.yml module declaration (confirm branch allow workflow makes sense, handle multiple flags)
- [ ] doc site & readme cleanup to reference
- [ ] add doc for testing with jest
- [ ] add note about typechecking & regen
