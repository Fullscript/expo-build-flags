#!/bin/bash

#
# WARNING - these tests build on top of each other
# adjust your initial test flag state accordingly
#

set -e

function logMark() {
	echo ""
	echo "###################################################################"
	echo "$1"
	echo "###################################################################"
	echo ""
}

logMark "Setting up test environment"
./test/setup.sh

cd example

logMark "Running test-overrides.sh"
../test/test-overrides.sh

logMark "Running test-babel-plugin.js"
node ../test/test-babel-plugin.js

logMark "Running test-config-plugin.js"
node ../test/test-config-plugin.js

logMark "Running test-config-plugin-android.js"
node ../test/test-config-plugin-android.js

logMark "Running test-autolinking.js"
node ../test/test-autolinking.js
