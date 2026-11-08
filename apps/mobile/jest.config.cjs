module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/test/**/*.test.jsx'],
  transform: { '^.+\\.[jt]sx?$': ['babel-jest', { presets: ['babel-preset-expo'] }], '^.+\\.mjs$': ['babel-jest', { presets: ['babel-preset-expo'] }] },
  moduleNameMapper: { '^@eureka/contracts$': '<rootDir>/../../packages/contracts/src/index.ts' },
  clearMocks: true,
};
