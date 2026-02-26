#!/bin/sh
set -eu

# Force Yarn to use node_modules linker inside Docker builds
yarn config set nodeLinker node-modules
