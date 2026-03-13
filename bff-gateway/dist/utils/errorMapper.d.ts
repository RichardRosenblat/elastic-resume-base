export interface AppError {
    statusCode: number;
    code: string;
    message: string;
}
export declare function mapDownstreamError(err: unknown): AppError;
//# sourceMappingURL=errorMapper.d.ts.map