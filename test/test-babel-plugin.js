const fs = require("fs");
const cp = require("child_process");

const isExpo55 = process.env.EXPO_SDK_TARGET === "55";

const fallbackBabelConfig = `
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  }
}
`;

installBabelPlugin();
generateBuildFlagsModule();
addBuildFlag();
bundleApp();
assertBuildFlagInBundle();
disableFeatureFlag();
bundleApp();
assertBuildFlagShakenFromBundle();
bundleAppAsJestAndAssertNoFolding();

function installBabelPlugin() {
  let babelConfig;
  try {
    babelConfig = fs.readFileSync("babel.config.js", "utf8");
  } catch (_) {}
  if (!babelConfig) {
    babelConfig = fallbackBabelConfig;
  }
  const searchStr = "return {";
  const replaceStr =
    'return {\n  plugins: [\n    ["expo-build-flags/babel-plugin", {\n      "flagsModule": "./constants/buildFlags.ts"\n    }]\n  ],\n';
  const newBabelConfig = babelConfig.replace(searchStr, replaceStr);
  fs.writeFileSync("babel.config.js", newBabelConfig);
}

function generateBuildFlagsModule() {
  cp.execSync("./node_modules/.bin/build-flags override");
}

function addBuildFlag() {
  if (isExpo55) {
    const homeTab = fs.readFileSync("src/app/index.tsx", "utf8");
    const searchStr = "function getDevMenuHint() {";
    let replaceStr = "import { BuildFlags } from '../../constants/buildFlags'";
    replaceStr += "\n\n";
    replaceStr +=
      "if (BuildFlags.newFeature) { console.log('New feature enabled!') }";
    replaceStr += "\n\n";
    replaceStr += "function getDevMenuHint() {";
    const newHomeTab = homeTab.replace(searchStr, replaceStr);
    fs.writeFileSync("src/app/index.tsx", newHomeTab);

    return;
  }

  const homeTab = fs.readFileSync("app/(tabs)/index.tsx", "utf8");
  const searchStr = "export default function HomeScreen() {";
  let replaceStr = "import { BuildFlags } from '../../constants/buildFlags'";
  replaceStr += "\n\n";
  replaceStr +=
    "if (BuildFlags.newFeature) { console.log('New feature enabled!') }";
  replaceStr += "\n\n";
  replaceStr += "export default function HomeScreen() {";
  const newHomeTab = homeTab.replace(searchStr, replaceStr);
  fs.writeFileSync("app/(tabs)/index.tsx", newHomeTab);
}

function bundleApp() {
  cp.execSync(
    "yarn expo export --no-bytecode --no-minify --clear --platform ios",
    {
      stdio: "inherit",
      env: {
        ...process.env,
        CI: "1",
      },
    },
  );
}

function bundleAppAsJestAndAssertNoFolding() {
  const result = cp.execSync(
    `../node_modules/.bin/babel ${isExpo55 ? `src/app` : `app/\\(tabs\\)`}/index.tsx --plugins=expo-build-flags/babel-plugin`,
    {
      env: {
        ...process.env,
        NODE_ENV: "test",
      },
    },
  );

  if (result.toString().includes("New feature enabled!") === false) {
    throw new Error(
      "Assertion failed: Build flag not found in jest build result",
    );
  }

  console.log("Assertion passed: Build flag found in jest bundle");
}

function assertBuildFlagInBundle() {
  const outputPath = "dist/_expo/static/js/ios";
  const bundleFile = fs
    .readdirSync(outputPath)
    .find((file) => file.startsWith("entry-"));
  const bundle = fs.readFileSync(`${outputPath}/${bundleFile}`, "utf8");
  if (!bundle.includes("New feature enabled!")) {
    throw new Error("Assertion failed: Build flag not found in bundle");
  }

  console.log("Assertion passed: Build flag found in bundle");
}

function disableFeatureFlag() {
  cp.execSync("./node_modules/.bin/build-flags override -newFeature");
}

function assertBuildFlagShakenFromBundle() {
  const outputPath = "dist/_expo/static/js/ios";
  const bundleFile = fs
    .readdirSync(outputPath)
    .find((file) => file.startsWith("entry-"));
  const bundle = fs.readFileSync(`${outputPath}/${bundleFile}`, "utf8");
  if (bundle.includes("New feature enabled!")) {
    throw new Error("Assertion failed: Build flag found in bundle");
  }

  console.log("Assertion passed: Build flag not found in bundle");
}
