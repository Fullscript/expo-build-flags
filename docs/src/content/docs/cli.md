---
title: CLI Reference
description: Command reference for the build-flags CLI.
---

The `build-flags` command is available after installing the `expo-build-flags` package. It is registered as a local bin, so it works in npm scripts and via `npx` without a global install.

## build-flags init

Scaffold a new `flags.yml` and generate the initial runtime module.

```bash
build-flags init
```

Detects your source directory (`src/` or `app/`) and sets `mergePath` accordingly. If a `.gitignore` exists, the generated module path is appended to it.

## build-flags override

Generate the runtime module from `flags.yml`, optionally enabling or disabling specific flags.

```bash
build-flags override [+flag ...] [-flag ...]
```

Prefix a flag name with `+` to enable it or `-` to disable it. Flags not listed keep their default value from `flags.yml`.

```bash
# Use defaults
build-flags override

# Enable one flag, disable another
build-flags override +newCheckout -legacyAuth
```

## build-flags ota-override

Same as `override`, but also enables flags whose `ota.branches` patterns match the current CI branch.

```bash
build-flags ota-override [+flag ...] [-flag ...]
```

The branch is read from `GITHUB_HEAD_REF` (GitHub Actions) or `CI_COMMIT_REF_NAME` (GitLab CI). Manual `+`/`-` overrides are applied on top of branch-matched flags.

## Options

### --skip-if-env \<ENV_VAR\>

Skip execution if the named environment variable is set. Works with any command.

```bash
build-flags override --skip-if-env EAS_BUILD
```

If `EAS_BUILD` is present in the environment (any value), the command exits immediately as a no-op. This is useful for avoiding conflicts with the [Config Plugin](/recipes/config-plugin/) during EAS builds.
