const fs = require("fs");
const cp = require("child_process");
const yaml = require("yaml");

// When a flag has invertFor.platform: [ios], and no EXPO_BUILD_FLAGS are set,
// the config plugin should produce platform-specific runtime files and
// per-platform native manifests.

const expectedIosModule = `
export const BuildFlags = {
    bundleIdScopedFeature: true,
    iosOnlyFeature: true,
    newFeature: true,
    publishedFeatured: true,
    secretAndroidFeature: false,
    secretFeature: false
};
`;

const expectedAndroidModule = `
export const BuildFlags = {
    bundleIdScopedFeature: true,
    iosOnlyFeature: false,
    newFeature: true,
    publishedFeatured: true,
    secretAndroidFeature: false,
    secretFeature: false
};
`;

addPlatformScopedFlag();
runPrebuild();
assertPlatformSpecificFiles();
assertAndroidManifest();
assertInfoPlist();

function addPlatformScopedFlag() {
  const flagsYmlString = fs.readFileSync("flags.yml", { encoding: "utf-8" });
  const flagConfig = yaml.parse(flagsYmlString);
  flagConfig.flags.iosOnlyFeature = {
    value: false,
    invertFor: {
      platform: ["ios"],
    },
  };
  fs.writeFileSync("flags.yml", yaml.stringify(flagConfig));
}

function runPrebuild() {
  // Clean stale runtime files before prebuild
  for (const f of [
    "constants/buildFlags.ts",
    "constants/buildFlags.ios.ts",
    "constants/buildFlags.android.ts",
  ]) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  cp.execSync("./node_modules/.bin/expo prebuild --no-install --clean", {
    env: {
      ...process.env,
      CI: 1,
      // No EXPO_BUILD_FLAGS — source of truth comes from flags.yml
    },
  });
}

function assertPlatformSpecificFiles() {
  // Single file should NOT exist
  if (fs.existsSync("constants/buildFlags.ts")) {
    throw new Error(
      "Expected single buildFlags.ts to NOT exist when platform files are generated"
    );
  }

  const iosContents = fs.readFileSync("constants/buildFlags.ios.ts", "utf8");
  if (iosContents.trim() !== expectedIosModule.trim()) {
    console.log(
      "iOS received:\n\n",
      `>${iosContents.trim()}<`,
      "\n\nexpected:\n\n",
      `>${expectedIosModule.trim()}<`
    );
    throw new Error("iOS buildFlags module does not match expected");
  }

  const androidContents = fs.readFileSync(
    "constants/buildFlags.android.ts",
    "utf8"
  );
  if (androidContents.trim() !== expectedAndroidModule.trim()) {
    console.log(
      "Android received:\n\n",
      `>${androidContents.trim()}<`,
      "\n\nexpected:\n\n",
      `>${expectedAndroidModule.trim()}<`
    );
    throw new Error("Android buildFlags module does not match expected");
  }

  console.log(
    "Assertion passed: Platform-specific runtime files generated correctly!"
  );
}

function assertAndroidManifest() {
  const fileContents = fs.readFileSync(
    "android/app/src/main/AndroidManifest.xml",
    "utf8"
  );
  // iosOnlyFeature should NOT be in Android manifest
  if (fileContents.includes("iosOnlyFeature")) {
    throw new Error(
      "Expected AndroidManifest.xml to NOT contain iosOnlyFeature"
    );
  }

  console.log(
    "Assertion passed: AndroidManifest.xml does not contain iOS-only flag!"
  );
}

function assertInfoPlist() {
  const fileContents = fs.readFileSync("ios/example/Info.plist", "utf8");
  if (!fileContents.includes("<string>iosOnlyFeature</string>")) {
    throw new Error("Expected Info.plist to contain iosOnlyFeature");
  }

  console.log("Assertion passed: Info.plist contains iOS-only flag!");
}
