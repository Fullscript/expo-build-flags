const fs = require("fs");
const cp = require("child_process");
const yaml = require("yaml");

// When a flag has invertFor.bundleId matching only ONE platform's identifier,
// the inversion must fire only on that platform's pass. Here the matcher equals
// android.package but NOT ios.bundleIdentifier (which carries a .dev suffix), so
// the flag should invert (-> true) on Android and stay default (false) on iOS.
//
// Regression guard: previously bundleId candidates pooled both platforms, so a
// matching android.package flipped the flag on the iOS pass too.

const matcher = "com.example.app";

addAndroidScopedFlag();
divergeIosBundleId();
runPrebuild();
assertIosNotInverted();
assertAndroidInverted();

function addAndroidScopedFlag() {
  const flagConfig = yaml.parse(fs.readFileSync("flags.yml", "utf-8"));
  flagConfig.flags.androidScopedFeature = {
    value: false,
    invertFor: {
      bundleId: [matcher],
    },
  };
  fs.writeFileSync("flags.yml", yaml.stringify(flagConfig));
}

function divergeIosBundleId() {
  const expoConfig = JSON.parse(fs.readFileSync("app.json", "utf-8"));
  // iOS gets a .dev suffix so it no longer matches the bundleId matcher;
  // android.package stays equal to the matcher.
  expoConfig.expo.ios.bundleIdentifier = `${matcher}.dev`;
  expoConfig.expo.android.package = matcher;
  fs.writeFileSync("app.json", JSON.stringify(expoConfig, null, 2));
}

function runPrebuild() {
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
    },
  });
}

function assertIosNotInverted() {
  const ios = fs.readFileSync("constants/buildFlags.ios.ts", "utf8");
  if (!ios.includes("androidScopedFeature: false")) {
    console.log("iOS received:\n\n", `>${ios.trim()}<`);
    throw new Error(
      "Expected androidScopedFeature to stay false on iOS (matcher does not match ios.bundleIdentifier)"
    );
  }

  console.log(
    "Assertion passed: bundleId inversion did not leak onto the iOS pass!"
  );
}

function assertAndroidInverted() {
  const android = fs.readFileSync("constants/buildFlags.android.ts", "utf8");
  if (!android.includes("androidScopedFeature: true")) {
    console.log("Android received:\n\n", `>${android.trim()}<`);
    throw new Error(
      "Expected androidScopedFeature to invert to true on Android (matcher equals android.package)"
    );
  }

  console.log(
    "Assertion passed: bundleId inversion fired on the matching Android pass!"
  );
}
