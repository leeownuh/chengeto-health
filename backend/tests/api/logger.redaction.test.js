import { redactSensitiveData } from '../../config/logger.js';

describe('Logger redaction', () => {
  it('redacts common secret-bearing fields recursively', () => {
    const payload = {
      email: 'user@example.com',
      password: 'Secret@123456',
      nested: {
        accessToken: 'abcd1234tokenvalue',
        refreshToken: 'refresh-token-value-123',
        authorization: 'Bearer very-secret-token',
        safe: 'keep-me'
      },
      list: [
        { apiKey: 'demo-key' },
        { message: 'ok' }
      ]
    };

    const redacted = redactSensitiveData(payload);

    expect(redacted.email).toBe('user@example.com');
    expect(redacted.password).not.toBe(payload.password);
    expect(redacted.nested.accessToken).not.toBe(payload.nested.accessToken);
    expect(redacted.nested.refreshToken).not.toBe(payload.nested.refreshToken);
    expect(redacted.nested.authorization).not.toBe(payload.nested.authorization);
    expect(redacted.nested.safe).toBe('keep-me');
    expect(redacted.list[0].apiKey).not.toBe(payload.list[0].apiKey);
    expect(redacted.list[1].message).toBe('ok');
  });
});
