/* eslint-disable @typescript-eslint/no-require-imports, no-undef */
const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push("cjs", "mjs");

module.exports = config;
