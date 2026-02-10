---
title: "Introducing expo-build-flags"
date: 2025-02-07
authors:
  - name: Wes Johnson
    url: https://github.com/sterlingwes
---

Remote feature flags work on mobile. We use them. Plenty of services can give you a dashboard, user targeting, and gradual rollouts, and they work fine in React Native apps. So why build another feature flag tool?

Because not every flag needs remote control, and the early life of a feature looks different from the late stages.

## Two stages of feature development

At our company, feature development tends to follow a pattern:

**Stage 1: Building.** A team starts work on a new feature. The code lands on `main` behind a conditional, but it's not ready for anyone outside the team to see. You don't need a percentage rollout or a kill switch -- you just need the feature _off_ for everyone except the people building it. You want control over which local environments, staging builds, and CI pipelines have it enabled. And you want that control without committing toggles or env files that affect everyone else.

**Stage 2: Releasing.** The feature is stable and headed to production. Now you decide: does this need remote control? If it's a risky change, you might want a gradual rollout or the ability to roll back without a new binary. If it's an experiment, you want targeting and metrics. That's where a remote flag service earns its keep.

Build flags handle stage 1. Remote flags handle stage 2. Sometimes a feature skips stage 2 entirely -- it's just done, and you remove the flag. The two approaches complement each other.

## Why build-time?

Some things are simpler to reason about when they're resolved before the app runs:

- **No network dependency.** The flag value is baked into the bundle. It doesn't depend on a service being reachable or an SDK initializing before your first render.
- **Dead code elimination.** When a flag is `false` at build time, the Babel plugin replaces it with a literal and the bundler strips the unreachable code path entirely. Your production bundle doesn't ship code for features that aren't enabled.
- **Native module control.** React Native autolinking happens at build time. If a feature depends on a native module, you can exclude that module from CocoaPods and Gradle when its flag is off. The binary stays smaller.
- **Developer ergonomics.** Each developer can enable the flags they're working on locally without touching committed files. New developers get a valid flag module automatically via `postinstall`.

None of this replaces what a remote flag service does. It's just another tool -- one that's useful earlier in the lifecycle of a feature.

## Getting started

```bash
yarn install expo-build-flags
yarn build-flags init
```

Check out the [Quick Start](/expo-build-flags/quick-start/) for a walkthrough, or browse the [Recipes](/expo-build-flags/recipes/config-plugin/) to set up the specific pieces you need.
