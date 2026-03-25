import nodemailer from 'nodemailer';
/**
 * SMTP-based implementation of {@link IMessagingService}.
 *
 * Uses **nodemailer** as the transport layer. All connection details and
 * credentials are supplied via {@link MessagingOptions} at construction time —
 * no values are hardcoded or read from the environment here; callers are
 * responsible for sourcing configuration (e.g. from `config.yaml`).
 *
 * @example
 * ```typescript
 * import { SmtpMessagingService } from '@elastic-resume-base/hermes';
 *
 * const service = new SmtpMessagingService({
 *   host: 'smtp.example.com',
 *   port: 587,
 *   user: 'alerts@example.com',
 *   password: 'secret',
 *   from: 'noreply@example.com',
 * });
 *
 * await service.send({
 *   to: 'ops@example.com',
 *   subject: 'Job failed',
 *   body: 'The DLQ job resume-ingestion-001 failed.',
 * });
 * ```
 */
export class SmtpMessagingService {
    _transporter;
    _from;
    /**
     * @param options - SMTP connection and authentication configuration.
     * @param transporter - Optional pre-built nodemailer {@link Transporter}.
     *   Provide this in tests to inject a mock transport and avoid real SMTP calls.
     */
    constructor(options, transporter) {
        this._from = options.from;
        this._transporter =
            transporter ??
                nodemailer.createTransport({
                    host: options.host,
                    port: options.port,
                    secure: options.secure ?? false,
                    auth: options.user != null && options.password != null
                        ? { user: options.user, pass: options.password }
                        : undefined,
                });
    }
    /**
     * Sends a message via SMTP.
     *
     * @param message - The message to deliver.
     * @returns A promise that resolves when nodemailer has accepted the message
     *   for delivery (i.e. the SMTP server has acknowledged receipt).
     * @throws {Error} If the SMTP server rejects the message or is unreachable.
     *
     * @example
     * ```typescript
     * await service.send({
     *   to: ['alice@example.com', 'bob@example.com'],
     *   subject: 'DLQ alert',
     *   body: '<p>A job failed.</p>',
     *   isHtml: true,
     * });
     * ```
     */
    async send(message) {
        const to = Array.isArray(message.to) ? message.to.join(', ') : message.to;
        await this._transporter.sendMail({
            from: this._from,
            to,
            subject: message.subject,
            ...(message.isHtml ? { html: message.body } : { text: message.body }),
        });
    }
}
//# sourceMappingURL=smtp-messaging-service.js.map