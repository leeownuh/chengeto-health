/**
 * Jest Environment Setup (runs before tests import modules)
 */

process.env.NODE_ENV = 'test';
if (!process.env.MONGODB_URI_TEST) {
  process.env.MONGODB_URI_TEST = 'mongodb://localhost:27017/chengeto_test';
}
process.env.JWT_SECRET = 'test_jwt_secret_key_for_testing_only';
process.env.JWT_EXPIRE = '1h';
process.env.ENCRYPTION_KEY = 'test_encryption_key_32_characters!';
