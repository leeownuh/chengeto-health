/**
 * Jest Test Setup
 */

let mongoServer;

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

beforeAll(async () => {
  if (!process.env.MONGODB_URI_TEST || process.env.MONGODB_URI_TEST.includes('localhost:27017')) {
    try {
      const { MongoMemoryServer } = await import('mongodb-memory-server');
      mongoServer = await MongoMemoryServer.create({
        instance: {
          dbName: 'chengeto_test'
        }
      });
      process.env.MONGODB_URI_TEST = mongoServer.getUri('chengeto_test');
    } catch (error) {
      console.warn(`MongoMemoryServer unavailable, falling back to MONGODB_URI_TEST=${process.env.MONGODB_URI_TEST}.`, error.message);
    }
  }
});

// Clean up after all tests
afterAll(async () => {
  if (mongoServer) {
    await mongoServer.stop();
  }
  // Close any open handles
  await new Promise(resolve => setTimeout(resolve, 500));
});
