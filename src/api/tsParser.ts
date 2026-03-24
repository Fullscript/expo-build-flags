import { readFileSync } from "node:fs";

export const parseTsConstantsModule = (sourcePath: string) => {
  const source = readFileSync(sourcePath, "utf-8");
  const flags: Record<string, boolean> = {};
  const pattern = /(\w+)\s*:\s*(true|false)/g;
  let match;
  while ((match = pattern.exec(source)) !== null) {
    flags[match[1]] = match[2] === "true";
  }
  return flags;
};
