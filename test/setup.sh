#!/bin/bash

set -e

if [ -z "$EXPO_SDK_TARGET" ]; then
	echo "Tests must specify EXPO_SDK_TARGET"
	echo ""
	exit 1
fi

npm run build

echo "Creating expo app"
rm -rf example
CI=1 npx create-expo-app --template "expo-template-default@$EXPO_SDK_TARGET" example

echo "Installing library"
cd example

if [ "$EXPO_SDK_TARGET" -eq "51" ]; then
	echo "Using expo SDK 51 with react-native 0.75.0"
	npm install --save react-native@~0.75.0
fi

if [ "$EXPO_SDK_TARGET" -eq "52" ]; then
	npx expo install expo-asset
fi

npm install --save-dev babel-preset-expo
npm install --install-links --save-dev ../

echo "copy over flag fixture"
cp ../test/overrides/default-flags.yml ./flags.yml
