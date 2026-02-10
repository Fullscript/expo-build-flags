---
title: Roadmap
description: Current status and future plans for expo-build-flags.
---

This page tracks the future direction of the library.

### Native code references

Allow reading flag values from native code on iOS (Swift/ObjC) and Android (Kotlin/Java). The metadata is already written to `Info.plist` and `AndroidManifest.xml` by the config plugin, but there is no convenience API to read it yet.

### Metro resolver proxy

Add a Metro resolver that intercepts imports of flagged-off native modules and returns a friendly error or no-op module, instead of letting the build crash with a confusing "module not found" message.

### Improved module declarations in flags.yml

Clean up the module declaration syntax in `flags.yml`. The current branch-allow workflow needs validation, and support for multiple flags referencing the same module needs to be handled correctly.

### Jest testing guide

Document the recommended patterns for testing code that reads `BuildFlags`. The Babel plugin is already disabled in test environments so flag values can be changed freely, but a guide with examples is needed.

### Type-checking and regeneration notes

Document how to keep TypeScript happy when the generated module doesn't exist yet (e.g. fresh clone before running `build-flags override`), and how to integrate regeneration into common development workflows.
