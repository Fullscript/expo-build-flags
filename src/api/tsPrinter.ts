import { FlagMap } from "./types";

export const printAsTs = (flags: FlagMap) => {
  const entries = Object.keys(flags)
    .sort()
    .map((key) => `    ${key}: ${flags[key].value}`)
    .join(",\n");
  return `export const BuildFlags = {\n${entries}\n};\n`;
};
