/** Unit tests only — see jest-e2e.config.js for API e2e tests against a real DB. */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  // Only transform our own .ts sources — libs/*/dist is already-compiled JS
  // (resolved outside node_modules via pnpm's symlink, so the default
  // transformIgnorePatterns wouldn't otherwise catch it).
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  testEnvironment: "node",
};
