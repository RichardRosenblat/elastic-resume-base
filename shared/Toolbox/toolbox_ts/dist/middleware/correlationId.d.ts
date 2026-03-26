interface CorrelationRequest {
    readonly headers: Readonly<Record<string, string | string[] | undefined>>;
    correlationId: string;
}
interface CorrelationReply {
    header(key: string, value: string): unknown;
}
export declare function correlationIdHook(request: CorrelationRequest, reply: CorrelationReply, done: () => void): void;
export {};
