/** e2e tests require infra/docker-compose.yml postgres running (pnpm setup) + migrations applied. */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: "test/.*\\.e2e-spec\\.ts$",
  // Only transform our own .ts sources — see jest.config.js for why.
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  testEnvironment: "node",
  setupFilesAfterEnv: ["<rootDir>/test/jest-setup.ts"],
};
