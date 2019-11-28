module.exports = {
  verbose: true,
  "collectCoverage": true,
  "globals": {
    "ts-jest": {
      "tsConfig": "tsconfig.jest.json"
    }
  },
  "transform": {
    "\\.ts": "ts-jest"
  },
  "testRegex": "(\\.|/)([jt]est)\\.[jt]s$",
  "moduleFileExtensions": [
    "ts",
    "js",
    "json"
  ],
  "setupFiles": [
    "<rootDir>/setup_tests.ts"
  ]
};
