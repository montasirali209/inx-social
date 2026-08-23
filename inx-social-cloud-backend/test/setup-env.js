// Loaded only by `npm test`. Production still requires real secrets from Railway.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET ||= 'inx-social-test-jwt-secret-at-least-32-characters';
process.env.TOKEN_ENCRYPTION_KEY ||= 'inx-social-test-encryption-key-at-least-32-characters';
