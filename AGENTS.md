# AGENTS.md

Guide for AI agents working in `expo-build-flags`. This is a TypeScript library published to npm that gives Expo/React Native projects a compile-time, tree-shakeable feature flag system. It ships four user-facing surfaces: a CLI, a programmatic API, a Babel plugin (for dead-code elimination), and an Expo config plugin (for native builds and autolinking exclusion).

## Commands

```bash
npm install                 # install deps
npm run build               # tsc -> build/  (REQUIRED before any consumer use; entries point at build/)
npm run test:unit           # jest only (fast)
npm run test                # unit + EXPO_SDK_TARGET=51 ./test/run-integration.sh
npm run test:next           # unit-less; integration with EXPO_SDK_TARGET=52
./node_modules/.bin/jest path/to/file.spec.ts   # single suite
```

There is no lint or format script. CI (`.github/workflows/test.yml`) runs jest, then SDK 51 and SDK 52 integration suites in parallel jobs (Node 18, Java 21, Ruby 3.3).

## Repo layout

```
src/
  api/             # core library (default export of the package, main = build/api/index.js)
  cli/             # bin entrypoints (main.ts -> build-flags, autolinking.ts -> build-flags-autolinking)
  babel-plugin/    # AST transform for tree-shaking BuildFlags references
  config-plugin/   # Expo config plugin (native manifests + bundle override + flagged autolinking)
bin/               # tiny shell shims that require ../build/cli/*.js (published)
app.plugin.js      # require('./build/config-plugin')   <- Expo's plugin entry
babel-plugin.js    # require('./build/babel-plugin')    <- consumer babel entry
test/              # bash + node integration harness; NOT compiled by tsc
docs/              # standalone Astro Starlight site (own package.json, independent install)
```

`tsconfig.json` excludes `test/`, `docs/`, `example/`, and `**/*.spec.ts`, so spec files never ship to `build/`. `package.json#files` ships only `bin`, `build`, `app.plugin.js`, `babel-plugin.js`. If you add a new top-level entry file, update `files` and `.npmignore` (which also excludes `src/`, `test/`, `tsconfig.json`).

## Architecture and data flow

Single source of truth is the consumer's `flags.yml`:

```yaml
mergePath: "constants/buildFlags.ts" # required; .ts or .json output target
flags:
  someFlag:
    value: false # required boolean
    meta: { team: "growth" } # opaque, not consumed
    ota: { branches: ["release/*"] } # CI branch glob -> enable on ota-override
    modules: ["react-native-foo"] # autolinking exclusions when value=false
    invertFor: { bundleId: ["com.x"] } # native-only conditional inversion
```

Resolution pipeline (`src/api/`):

1. `readConfig()` parses `flags.yml` from `cwd`, validates `mergePath` + per-flag `value: boolean` + `ota.branches` array shape, and `process.exit(1)`s on failure (it does not throw).
2. `BuildFlags` class mutates a `FlagMap` via `enable(Set)` / `disable(Set)` / `enableBranchFlags()`. **Enabling/disabling an undefined flag throws** — callers must filter unknown names if they want lenient behavior.
3. `BuildFlags.save(path)` dispatches by extension: `.json` -> `JSON.stringify`, `.ts` -> `tsPrinter.printAsTs` (uses the TypeScript compiler API to emit `export const BuildFlags = { ... }` with **alphabetically sorted keys**). Any other extension throws.
4. `resolveFlagsToInvert(expoConfig)` is native-only: it reads bundle IDs from `expoConfig.ios.bundleIdentifier` and `expoConfig.android.package` and flips `value` for matching flags. JS-side runtime ignores `invertFor` — the README is explicit about this and tests assert it.

CLI (`src/cli/main.ts`):

- Argv format is positional: a single command word (`init` | `override` | `ota-override`) plus `+flag`/`-flag` tokens (no `=`, no quotes). `--skip-if-env <VAR>` is spliced out of argv before flag parsing; presence of the env var makes the command a no-op.
- `init` writes `flags.yml` and the runtime module, and **appends `mergePath` to `.gitignore`** if one exists. It picks `src/` or `app/` if either exists, else cwd, for the runtime module path.

Babel plugin (`src/babel-plugin/index.ts`):

- Replaces `BuildFlags.someFlag` member expressions with literal `true`/`false` so Metro/terser can dead-code eliminate.
- Also **removes the entire `require("...buildFlags")` VariableDeclarator** so the runtime module isn't shipped at all. Match is by substring of `options.flagsModule` minus `./` `..` segments and `.ts`.
- **`process.env.NODE_ENV === "test"` short-circuits to no-op visitors.** This is required so Jest sees real imports; the babel-plugin integration test explicitly verifies that under `NODE_ENV=test` the flag value is preserved (`assertNoFolding`).
- Requires `flagsModule` to end in `.ts`; JSON is rejected with a TypeError.

Config plugin (`src/config-plugin/index.ts`):

- `EXPO_BUILD_FLAGS=foo,bar` (comma-separated, trimmed) is the only build-time input.
- Three concurrent mods: `withAndroidManifest` (adds `<meta-data android:name="EXBuildFlags" android:value="..."/>`), `withInfoPlist` (adds `EXBuildFlags` array), and a `withDangerousMod` for both platforms that regenerates the runtime TS module via `generateOverrides`. The dangerous mod is skipped when `skipBundleOverride: true` is passed.
- `cachedResolvedFlags` is a **module-level cache** so the three mods don't re-read `flags.yml` and `invertFor` resolution stays consistent across native + bundle passes. Same pattern in `withFlaggedAutolinking` via the `exclude` cache. Don't break this without checking the integration tests.
- `flaggedAutolinking: true` (opt-in) wires the autolinking rewrite. It detects Expo SDK major version by `require("expo/package.json")` from the consumer and dispatches to per-SDK Podfile updaters (`updatePodfileReactNativeAutolinkCallForSDK51` matches `origin_autolinking_method.call(config_command)`; SDK 52+ matches `config = use_native_modules!(config_command)`). Android uses one `settings.gradle` updater for all SDKs.
- The Podfile/settings.gradle rewrites inject calls to `node_modules/.bin/build-flags-autolinking -p ios|android -x mod1 -x mod2`. That's the second bin: `src/cli/autolinking.ts` shells out to `expo-modules-autolinking react-native-config --json`, captures stdout by monkey-patching `console.log`, deletes the excluded keys, and prints the filtered JSON. **Don't add `console.log` debugging anywhere this code path executes** — its output IS the contract.

## Conventions

- Spec files live next to source as `*.spec.ts` (`src/api/foo.ts` + `src/api/foo.spec.ts`). `jest.config.js` sets `roots: ["<rootDir>/src"]`. Tests in `test/` are **not** jest — they're bash/Node integration scripts.
- TypeScript target is `@tsconfig/node18`. The package only depends on `yaml` and `@babel/helper-plugin-utils` at runtime; `typescript` is a peer dependency (the lib uses the consumer's `typescript` for `tsPrinter`/`tsParser`). Don't add runtime deps casually.
- `@expo/config-plugins` and `@expo/config-types` are devDependencies — they're only types/runtime in the config-plugin path, which the consumer must already have.
- Code style: 2-space indent, double quotes, trailing commas, no semicolons omitted. No prettier/eslint config — match surrounding code.
- Sets (`Set<string>`) are used throughout for flag name collections; prefer them over arrays for new code in this area to keep `mergeSets` and existing call sites consistent.
- Public API surface is exactly what `src/api/index.ts` re-exports. Adding to it is a versioning concern.

## Integration tests (gotchas)

`./test/run-integration.sh` requires `EXPO_SDK_TARGET` (51 or 52). It does, in order:

1. `./test/setup.sh` — runs `npm run build`, deletes `example/`, calls `npx create-expo-app --template expo-template-default@$EXPO_SDK_TARGET example`, then `npm install --install-links --save-dev ../` to link this package into the fresh app. For SDK 51 it pins `react-native@~0.75.0`. Copies `test/overrides/default-flags.yml` to `example/flags.yml`.
2. `test-overrides.sh` — exercises CLI `override` and the programmatic `generateOverrides` API; diffs `example/constants/buildFlags.ts` against `test/overrides/expected-*.ts` (snapshot equality is strict whitespace match).
3. `test-babel-plugin.js` — bundles with `expo export` twice (flag on, flag off) and greps the bundle for the gated `console.log`.
4. `test-config-plugin.js` — patches `flags.yml` in place to add an `invertFor` flag, runs `expo prebuild` with `EXPO_BUILD_FLAGS=secretFeature,newFeature`, asserts AndroidManifest, Info.plist, **and** the regenerated runtime TS module.
5. `test-config-plugin-android.js` and `test-autolinking.js` — exercise flagged autolinking; the latter uses `expo-native-lockfiles` and `pod-lockfile` to run iOS lockfile generation on Linux.

**These tests build on each other** (the script comment says so explicitly): `test-autolinking.js` assumes `test-config-plugin.js` already installed the plugin in `app.json`, then upgrades it to `["expo-build-flags", { flaggedAutolinking: true }]`. If you reorder them or change `default-flags.yml` you must update the expected-\* fixtures and the chained mutations in each script.

The integration suite installs and prebuilds full Expo apps on every run — it is slow (minutes) and requires network, Java, Ruby, and CocoaPods support. Run `npm run test:unit` for fast iteration.

## Common edits

- **Adding a new flag config field**: extend `FlagConfig` in `src/api/types.ts`, add validation in `readConfig.ts`, and document it in `README.md` and `docs/src/content/docs/`.
- **New CLI command**: add a branch in `src/cli/main.ts#run` and update `printHelp`. Extend `parseArgs` only if the new command needs new tokens; the spec lives at `src/cli/main.spec.ts`.
- **Supporting a new Expo SDK**: add an entry to `appleRNLinkingLookup` / `appleExpoLinkingLookup` in `src/config-plugin/withFlaggedAutolinking.ts` keyed by major version. The `default` key handles unknown future versions — bump it when the latest known-good shape changes. Add the SDK number as a new GitHub Actions job in `.github/workflows/test.yml`.
- **Changing the generated TS module shape**: update both `tsPrinter.printAsTs` (writer) and `tsParser.parseTsConstantsModule` (reader used by the babel plugin). The parser hard-codes `BuildFlags` as the export name and expects the first statement to be the variable declaration.

## Docs site

`docs/` is an independent Astro Starlight project with its own `package.json` and nested lockfile. Deployed by `.github/workflows/docs.yml`. Don't `npm install` from the repo root expecting docs deps — `cd docs && npm install` separately. Content under `docs/src/content/docs/` is the source of truth for user-facing documentation; keep `README.md` in sync for top-level concepts only.
