/**
 * Parse the EXPO_BUILD_FLAGS env var.
 *
 * Format mirrors the `build-flags override` CLI:
 *   - `flagName` or `+flagName` -> enable
 *   - `-flagName`               -> disable
 * Entries are comma-separated; whitespace around each entry (and between the
 * prefix and the name) is ignored. Empty entries and bare prefixes are skipped.
 *
 * Disable wins if the same name appears with both prefixes; downstream resolution
 * applies the disable set after the enable set.
 */
export const parseEnvFlags = (
  raw: string | undefined = process.env.EXPO_BUILD_FLAGS
): { flagsToEnable: Set<string>; flagsToDisable: Set<string> } => {
  const flagsToEnable = new Set<string>();
  const flagsToDisable = new Set<string>();

  if (!raw) {
    return { flagsToEnable, flagsToDisable };
  }

  raw.split(",").forEach((entry) => {
    const trimmed = entry.trim();
    if (!trimmed) return;

    if (trimmed.startsWith("-")) {
      const name = trimmed.slice(1).trim();
      if (name) flagsToDisable.add(name);
      return;
    }

    const name = trimmed.startsWith("+") ? trimmed.slice(1).trim() : trimmed;
    if (name) flagsToEnable.add(name);
  });

  return { flagsToEnable, flagsToDisable };
};
