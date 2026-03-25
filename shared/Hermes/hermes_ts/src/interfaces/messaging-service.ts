/**
 * Represents a message to be delivered via a messaging transport.
 *
 * @example
 * ```typescript
 * const message: Message = {
 *   to: ['ops@example.com', 'alerts@example.com'],
 *   subject: 'Job failure in DLQ',
 *   body: 'The following job failed: resume-ingestion-001',
 * };
 * ```
 */
export interface Message {
  /** One or more recipient addresses (e.g. email addresses). */
  to: string | string[];

  /** Subject line or title of the message. */
  subject: string;

  /** Body text of the message. */
  body: string;

  /**
   * When `true`, the {@link Message.body} is treated as HTML.
   * Defaults to `false` (plain text).
   */
  isHtml?: boolean;
}

/**
 * Abstraction over any messaging transport (SMTP, Slack, SendGrid, etc.).
 *
 * Services should depend on this interface rather than on any concrete
 * implementation. Switching transports then requires only a Hermes
 * configuration change — no consuming service needs to be refactored.
 *
 * @example
 * ```typescript
 * import type { IMessagingService, Message } from '@elastic-resume-base/hermes';
 *
 * class AlertService {
 *   constructor(private readonly _messaging: IMessagingService) {}
 *
 *   async sendAlert(text: string): Promise<void> {
 *     await this._messaging.send({ to: 'ops@example.com', subject: 'Alert', body: text });
 *   }
 * }
 * ```
 */
export interface IMessagingService {
  /**
   * Sends a message to one or more recipients.
   *
   * @param message - The message to deliver.
   * @returns A promise that resolves when the message has been accepted by the transport.
   * @throws {Error} If the transport rejects the message or is unreachable.
   */
  send(message: Message): Promise<void>;
}
