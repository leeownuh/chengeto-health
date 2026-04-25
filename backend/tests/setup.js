/**
 * Jest Test Setup
 */

// Suppress console logs in tests (comment out for debugging)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
// };

// Global test utilities
global.testUtils = {
  generateRandomEmail: () => `test_${Date.now()}_${Math.random().toString(36).substring(7)}@test.com`,
  generateRandomPhone: () => `+263 77 ${Math.floor(Math.random() * 1000000).toString().padStart(6, '0')}`,
  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),
};

// Clean up after all tests
afterAll(async () => {
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 500));
});
