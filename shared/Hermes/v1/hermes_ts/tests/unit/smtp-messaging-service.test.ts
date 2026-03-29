/**
 * Unit tests for SmtpMessagingService.
 *
 * nodemailer is fully mocked — no real SMTP connection is made.
 */

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

import nodemailer from 'nodemailer';
import { SmtpMessagingService } from '../../src/services/smtp-messaging-service.js';
import type { Message } from '../../src/interfaces/messaging-service.js';

/** Builds a mock nodemailer transporter. */
function buildMockTransporter(sendMailImpl?: jest.Mock) {
  return {
    sendMail: sendMailImpl ?? jest.fn().mockResolvedValue({ messageId: 'test-id' }),
  };
}

describe('SmtpMessagingService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // constructor
  // ---------------------------------------------------------------------------
  describe('constructor', () => {
    it('creates a nodemailer transporter with the given options', () => {
      (nodemailer.createTransport as jest.Mock).mockReturnValue(buildMockTransporter());

      new SmtpMessagingService({
        host: 'smtp.example.com',
        port: 587,
        secure: false,
        from: 'noreply@example.com',
      });

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          host: 'smtp.example.com',
          port: 587,
          secure: false,
        }),
      );
    });

    it('includes auth when user and password are provided', () => {
      (nodemailer.createTransport as jest.Mock).mockReturnValue(buildMockTransporter());

      new SmtpMessagingService({
        host: 'smtp.example.com',
        port: 587,
        user: 'alerts@example.com',
        password: 'secret',
        from: 'noreply@example.com',
      });

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({
          auth: { user: 'alerts@example.com', pass: 'secret' },
        }),
      );
    });

    it('omits auth when user is not provided', () => {
      (nodemailer.createTransport as jest.Mock).mockReturnValue(buildMockTransporter());

      new SmtpMessagingService({ host: 'relay.example.com', port: 25, from: 'noreply@example.com' });

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ auth: undefined }),
      );
    });

    it('defaults secure to false when not specified', () => {
      (nodemailer.createTransport as jest.Mock).mockReturnValue(buildMockTransporter());

      new SmtpMessagingService({ host: 'localhost', port: 1025, from: 'noreply@local' });

      expect(nodemailer.createTransport).toHaveBeenCalledWith(
        expect.objectContaining({ secure: false }),
      );
    });

    it('uses the injected transporter instead of creating one', () => {
      const mockTransporter = buildMockTransporter();
      new SmtpMessagingService({ host: 'localhost', port: 25, from: 'noreply@local' }, mockTransporter as never);

      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // send — plain text
  // ---------------------------------------------------------------------------
  describe('send (plain text)', () => {
    it('calls sendMail with the correct envelope fields', async () => {
      const sendMail = jest.fn().mockResolvedValue({ messageId: 'abc' });
      const service = new SmtpMessagingService(
        { host: 'localhost', port: 25, from: 'noreply@example.com' },
        buildMockTransporter(sendMail) as never,
      );

      const message: Message = {
        to: 'alice@example.com',
        subject: 'Test subject',
        body: 'Hello, world!',
      };
      await service.send(message);

      expect(sendMail).toHaveBeenCalledWith({
        from: 'noreply@example.com',
        to: 'alice@example.com',
        subject: 'Test subject',
        text: 'Hello, world!',
      });
    });

    it('joins multiple recipients with ", "', async () => {
      const sendMail = jest.fn().mockResolvedValue({});
      const service = new SmtpMessagingService(
        { host: 'localhost', port: 25, from: 'noreply@example.com' },
        buildMockTransporter(sendMail) as never,
      );

      await service.send({
        to: ['alice@example.com', 'bob@example.com'],
        subject: 'Multi-recipient',
        body: 'Message body',
      });

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'alice@example.com, bob@example.com' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // send — HTML
  // ---------------------------------------------------------------------------
  describe('send (HTML)', () => {
    it('uses the html field when isHtml is true', async () => {
      const sendMail = jest.fn().mockResolvedValue({});
      const service = new SmtpMessagingService(
        { host: 'localhost', port: 25, from: 'noreply@example.com' },
        buildMockTransporter(sendMail) as never,
      );

      await service.send({
        to: 'alice@example.com',
        subject: 'HTML message',
        body: '<p>Hello</p>',
        isHtml: true,
      });

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ html: '<p>Hello</p>' }),
      );
      // Should NOT include a text field
      expect(sendMail.mock.calls[0]?.[0]).not.toHaveProperty('text');
    });

    it('uses the text field when isHtml is false', async () => {
      const sendMail = jest.fn().mockResolvedValue({});
      const service = new SmtpMessagingService(
        { host: 'localhost', port: 25, from: 'noreply@example.com' },
        buildMockTransporter(sendMail) as never,
      );

      await service.send({
        to: 'alice@example.com',
        subject: 'Plain text message',
        body: 'Hello',
        isHtml: false,
      });

      expect(sendMail).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Hello' }),
      );
      expect(sendMail.mock.calls[0]?.[0]).not.toHaveProperty('html');
    });
  });

  // ---------------------------------------------------------------------------
  // send — error propagation
  // ---------------------------------------------------------------------------
  describe('send (error handling)', () => {
    it('propagates errors thrown by sendMail', async () => {
      const sendMail = jest.fn().mockRejectedValue(new Error('SMTP connection refused'));
      const service = new SmtpMessagingService(
        { host: 'localhost', port: 25, from: 'noreply@example.com' },
        buildMockTransporter(sendMail) as never,
      );

      await expect(
        service.send({ to: 'alice@example.com', subject: 'Test', body: 'Test body' }),
      ).rejects.toThrow('SMTP connection refused');
    });
  });
});
