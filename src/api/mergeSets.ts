export const mergeSets = (
  setA: Set<string>,
  setB: Set<string>
): Set<string> => {
  const mergedSet = new Set<string>(setA);
  for (const item of setB) {
    mergedSet.add(item);
  }
  return mergedSet;
};
