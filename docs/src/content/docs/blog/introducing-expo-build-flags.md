---
title: "Introducing expo-build-flags"
date: 2025-02-07
authors:
  - name: Wes Johnson
    url: https://github.com/wes337
---

Feature flags are a solved problem for web apps. Services like LaunchDarkly and Statsig give you a dashboard, user targeting, and gradual rollouts. But if you're building a React Native app with Expo, the story is different.

Mobile releases ship as binaries. You can't just flip a server-side flag and have every user see the change. Your JavaScript bundle is frozen at build time. Native modules are linked at compile time. And when you're working across iOS, Android, and EAS Build, the question "is this feature on?" has to be answered in several places at once.

**expo-build-flags** is a small toolkit that makes build-time feature flags practical for Expo projects.

## The problem

Here's a common scenario: your team is developing a new checkout flow. The code lives on `main` behind a conditional, and you need:

- The flag **off by default** so it doesn't ship to production.
- The flag **on during local development** so you can work on it, without changing committed code.
- The flag **on for staging builds** in EAS so QA can test it.
- The native module the feature depends on **excluded from autolinking** in production builds where the flag is off, so the binary stays small.
- The **dead code eliminated** from production bundles when the flag is off.

Most teams cobble this together with environment variables, custom scripts, and manual coordination. It works, but it's fragile and hard to reason about.

## How it works

You define your flags in a single `flags.yml` at the project root:

```yaml
mergePath: src/constants/buildFlags.ts
flags:
  newCheckout:
    value: false
    modules:
      - react-native-reanimated
    meta:
      team: growth
```

Running `build-flags override` generates a TypeScript module at the `mergePath`:

```ts
export const BuildFlags = {
  newCheckout: false,
};
```

This file is gitignored. Your app imports it like any other module:

```tsx
import { BuildFlags } from './src/constants/buildFlags';

if (BuildFlags.newCheckout) {
  return <NewCheckoutFlow />;
}
```

That's the basic loop. From there, each piece of the toolkit layers on:

**Local overrides**: `build-flags override +newCheckout` regenerates the module with the flag enabled. No committed files change.

**EAS builds**: add `"plugins": ["expo-build-flags"]` to your app.json and set `EXPO_BUILD_FLAGS=newCheckout` in your EAS build profile. The config plugin generates the module and writes metadata to `Info.plist` and `AndroidManifest.xml`.

**Tree shaking**: add the Babel plugin and `BuildFlags.newCheckout` is replaced with `false` at bundle time. The minifier strips the dead code path.

**Flagged autolinking**: with `flaggedAutolinking: true`, native modules declared on a disabled flag are excluded from CocoaPods and Gradle during prebuild.

## What it's not

This is not a runtime feature flag service. There's no dashboard, no user targeting, no percentage rollouts. It's a build-time tool: flags are booleans that are resolved before the app runs.

If you need runtime flags, use a service like LaunchDarkly or Statsig alongside this. expo-build-flags handles the build pipeline; runtime services handle the user-facing decisions.

## Getting started

```bash
npm install expo-build-flags
build-flags init
```

Check out the [Quick Start](/quick-start/) for a walkthrough, or browse the [Recipes](/recipes/config-plugin/) to set up the specific pieces you need.
