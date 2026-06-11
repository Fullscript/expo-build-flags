import YAML from "yaml";
import { readFile, writeFile } from "fs/promises";

/**
 * Sort the keys of the `flags` map alphabetically, preserving comments,
 * quoting, and the order of every other node. Backed by the yaml parser so
 * output is always valid YAML; throws if the input does not parse.
 */
export const formatFlagsYaml = (content: string): string => {
  const doc = YAML.parseDocument(content);
  if (doc.errors.length > 0) {
    throw doc.errors[0];
  }
  const flags = doc.get("flags", true);
  if (YAML.isMap(flags)) {
    flags.items.sort((a, b) => {
      const aKey = String(a.key);
      const bKey = String(b.key);
      return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
    });
  }
  return doc.toString();
};

/** Read flags.yml, sort its `flags` keys, and write it back in place. */
export const formatFlagsFile = async (path = "flags.yml"): Promise<void> => {
  const content = await readFile(path, { encoding: "utf-8" });
  await writeFile(path, formatFlagsYaml(content));
};
