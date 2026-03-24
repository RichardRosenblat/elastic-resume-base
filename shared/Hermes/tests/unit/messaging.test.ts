/**
 * Unit tests for the Hermes messaging initialisation module.
 *
 * All nodemailer transports are mocked so no real SMTP server is required.
 */

jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'mock-id' }),
  }),
}));

import nodemailer from 'nodemailer';
import {
  initializeMessaging,
  initializeMessagingFromEnv,
  getMessagingService,
  _resetMessagingForTesting,
} from '../../src/messaging.js';

describe('Hermes messaging initialisation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    _resetMessagingForTesting();

    // Clear relevant env vars before each test
    delete process.env['SMTP_HOST'];
    delete process.env['SMTP_PORT'];
    delete process.env['SMTP_SECURE'];
    delete process.env['SMTP_USER'];
    delete process.env['SMTP_PASSWORD'];
    delete process.env['SMTP_FROM'];
  });

  // ---------------------------------------------------------------------------
  // initializeMessaging
  // ---------------------------------------------------------------------------
  describe('initializeMessaging', () => {
    it('creates an SmtpMessagingService and makes it available via getMessagingService', () => {
      initializeMessaging({
        host: 'smtp.example.com',
        port: 587,
        from: 'noreply@example.com',
      });

      const service = getMessagingService();
      expect(service).toBeDefined();
    });

    it('is idempotent — a second call does not replace the first service', () => {
      initializeMessaging({ host: 'first.example.com', port: 25, from: 'a@example.com' });
      initializeMessaging({ host: 'second.example.com', port: 25, from: 'b@example.com' });

      // createTransport should have been called only once
      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    });

    it('passes host, port and from to createTransport', () => {
      initializeMessaging({ host: 'smtp.test.com', port: 465, secure: true, from: 'x@test.com' });

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'smtp.test.com', port: 465, secure: true }),
      );
    });

    it('passes auth credentials when user and password are supplied', () => {
      initializeMessaging({
        host: 'smtp.test.com',
        port: 587,
        user: 'user@test.com',
        password: 'secret',
        from: 'noreply@test.com',
      });

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ auth: { user: 'user@test.com', pass: 'secret' } }),
      );
    });

    it('omits auth when neither user nor password are supplied', () => {
      initializeMessaging({ host: 'relay.test.com', port: 25, from: 'noreply@test.com' });

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ auth: undefined }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // initializeMessagingFromEnv
  // ---------------------------------------------------------------------------
  describe('initializeMessagingFromEnv', () => {
    it('reads SMTP_HOST, SMTP_PORT and SMTP_FROM from process.env', () => {
      process.env['SMTP_HOST'] = 'smtp.env-test.com';
      process.env['SMTP_PORT'] = '2525';
      process.env['SMTP_FROM'] = 'env@example.com';

      initializeMessagingFromEnv();

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ host: 'smtp.env-test.com', port: 2525 }),
      );
    });

    it('coerces SMTP_PORT string to a number', () => {
      process.env['SMTP_HOST'] = 'localhost';
      process.env['SMTP_PORT'] = '1025';
      process.env['SMTP_FROM'] = 'test@local';

      initializeMessagingFromEnv();

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ port: 1025 }),
      );
    });

    it('sets secure=true when SMTP_SECURE is "true"', () => {
      process.env['SMTP_HOST'] = 'localhost';
      process.env['SMTP_PORT'] = '465';
      process.env['SMTP_SECURE'] = 'true';
      process.env['SMTP_FROM'] = 'test@local';

      initializeMessagingFromEnv();

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ secure: true }),
      );
    });

    it('sets secure=false when SMTP_SECURE is absent', () => {
      process.env['SMTP_HOST'] = 'localhost';
      process.env['SMTP_PORT'] = '587';
      process.env['SMTP_FROM'] = 'test@local';

      initializeMessagingFromEnv();

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ secure: false }),
      );
    });

    it('is idempotent — a second call does not replace the first service', () => {
      process.env['SMTP_HOST'] = 'localhost';
      process.env['SMTP_PORT'] = '1025';
      process.env['SMTP_FROM'] = 'first@local';

      initializeMessagingFromEnv();
      initializeMessagingFromEnv();

      expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    });

    it('throws a ZodError when SMTP_HOST is missing', () => {
      process.env['SMTP_PORT'] = '587';
      process.env['SMTP_FROM'] = 'test@example.com';

      expect(() => initializeMessagingFromEnv()).toThrow();
    });

    it('throws a ZodError when SMTP_PORT is missing', () => {
      process.env['SMTP_HOST'] = 'localhost';
      process.env['SMTP_FROM'] = 'test@example.com';

      expect(() => initializeMessagingFromEnv()).toThrow();
    });

    it('throws a ZodError when SMTP_FROM is missing', () => {
      process.env['SMTP_HOST'] = 'localhost';
      process.env['SMTP_PORT'] = '587';

      expect(() => initializeMessagingFromEnv()).toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // getMessagingService
  // ---------------------------------------------------------------------------
  describe('getMessagingService', () => {
    it('throws if called before initialisation', () => {
      expect(() => getMessagingService()).toThrow(
        /initializeMessaging\(\) or initializeMessagingFromEnv\(\)/,
      );
    });

    it('returns the same instance on repeated calls', () => {
      initializeMessaging({ host: 'localhost', port: 25, from: 'noreply@local' });

      const a = getMessagingService();
      const b = getMessagingService();
      expect(a).toBe(b);
    });
  });
});
