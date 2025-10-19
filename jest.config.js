// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'miniflare',
  testEnvironmentOptions: {
    // Miniflare-specific options go here
    scriptPath: 'dist/index.js',
    modules: true,
    wranglerConfigPath: './wrangler.toml',
  },
};
