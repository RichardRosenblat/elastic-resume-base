interface MinimalLogger {
    info(data: Record<string, unknown>, msg: string): void;
}
interface LoggableRequest {
    readonly method: string;
    readonly url: string;
    readonly correlationId: string;
}
interface LoggableReply {
    readonly statusCode: number;
    readonly elapsedTime: number;
}
export declare function createRequestLoggerHook(logger: MinimalLogger): (request: LoggableRequest, reply: LoggableReply, done: () => void) => void;
export {};
