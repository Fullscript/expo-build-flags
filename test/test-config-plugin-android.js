const fs = require("fs");
const cp = require("child_process");
const yaml = require("yaml");

const expectedRuntimeModule = `
export const BuildFlags = {
    bundleIdScopedFeature: true,
    newFeature: true,
    publishedFeatured: true,
    secretAndroidFeature: true,
    secretFeature: false
};
`;

addBundleIdScopedFlag();
installExpoConfigPlugin();
runPrebuild();
assertFlagsAllTrue();

function addBundleIdScopedFlag() {
  const flagsYmlString = fs.readFileSync("flags.yml", { encoding: "utf-8" });
  const flagConfig = yaml.parse(flagsYmlString);
  flagConfig.flags.bundleIdScopedFeature = {
    value: false,
    invertFor: {
      bundleId: ["com.example.app"],
    },
  };
  fs.writeFileSync("flags.yml", yaml.stringify(flagConfig));
}

function installExpoConfigPlugin() {
  const expoConfig = JSON.parse(fs.readFileSync("app.json", "utf-8"));
  expoConfig.expo.plugins.push("expo-build-flags");
  expoConfig.expo.ios.bundleIdentifier = "com.example.app";
  expoConfig.expo.android.package = "com.example.app";
  fs.writeFileSync("app.json", JSON.stringify(expoConfig, null, 2));
}

function runPrebuild() {
  cp.execSync("./node_modules/.bin/expo prebuild -p android --clean", {
    env: {
      ...process.env,
      CI: 1,
      EXPO_BUILD_FLAGS: "secretAndroidFeature",
    },
  });
}

function assertFlagsAllTrue() {
  const fileContents = fs.readFileSync("constants/buildFlags.ts", "utf8");
  if (fileContents.trim() !== expectedRuntimeModule.trim()) {
    console.log(
      "received:\n\n",
      `>${fileContents.trim()}<`,
      "\n\n",
      "expected:\n\n",
      `>${expectedRuntimeModule.trim()}<`,
      "\n\n"
    );

    throw new Error(
      "Expected runtime buildFlags.ts module to contain all flags as true"
    );
  }

  console.log(
    "Assertion passed: Runtime build flags enabled by config plugin!"
  );
}
