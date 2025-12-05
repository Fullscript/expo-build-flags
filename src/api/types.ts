type InvertMatchers = { bundleId?: string[] };
type OTAFilter = { branches: string[] };
type ModuleConfig = string | { branch: string };
export type FlagConfig = {
  value: boolean;
  meta: any;
  ota?: OTAFilter;
  modules?: ModuleConfig[];
  invertFor?: InvertMatchers;
};
export type FlagMap = Record<string, FlagConfig>;
export type FlagsConfig = {
  mergePath: string;
  flags: FlagMap;
};

export type InvertableFlagTuple = [
  string,
  Omit<FlagConfig, "invertFor"> & { invertFor: InvertMatchers }
];
