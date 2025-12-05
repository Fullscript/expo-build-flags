const fs = require("fs");
const cp = require("child_process");
const yaml = require("yaml");

const expectedRuntimeModule = `
export const BuildFlags = {
    bundleIdScopedFeature: true,
    newFeature: true,
    publishedFeatured: true,
    secretFeature: true
};
`;

const expectedManifestTag =
  '<meta-data android:name="EXBuildFlags" android:value="secretFeature,newFeature"/>';

const expectedPlistFlagArray = `
    <key>EXBuildFlags</key>
    <array>
      <string>secretFeature</string>
      <string>newFeature</string>
    </array>
`;

addBundleIdScopedFlag();
installExpoConfigPlugin();
runPrebuild();
assertFlagsAllTrue();
assertAndroidManifest();
assertInfoPlist();

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
  cp.execSync("./node_modules/.bin/expo prebuild --no-install --clean", {
    env: {
      ...process.env,
      CI: 1,
      EXPO_BUILD_FLAGS: "secretFeature,newFeature",
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

function assertAndroidManifest() {
  const fileContents = fs.readFileSync(
    "android/app/src/main/AndroidManifest.xml",
    "utf8"
  );
  if (!fileContents.includes(expectedManifestTag)) {
    throw new Error(
      "Expected AndroidManifest.xml to contain EXBuildFlags meta-data tag"
    );
  }

  console.log(
    "Assertion passed: AndroidManifest.xml updated by config plugin!"
  );
}

function assertInfoPlist() {
  const fileContents = fs.readFileSync("ios/example/Info.plist", "utf8");
  if (!fileContents.includes(expectedPlistFlagArray.trim())) {
    throw new Error("Expected Info.plist to contain EXBuildFlags array");
  }

  console.log("Assertion passed: Info.plist updated by config plugin!");
}
