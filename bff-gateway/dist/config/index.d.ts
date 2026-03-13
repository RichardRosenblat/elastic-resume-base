import { z } from 'zod';
declare const configSchema: z.ZodObject<{
    port: z.ZodDefault<z.ZodNumber>;
    nodeEnv: z.ZodDefault<z.ZodEnum<["development", "production", "test"]>>;
    projectId: z.ZodDefault<z.ZodString>;
    firestoreEmulatorHost: z.ZodOptional<z.ZodString>;
    firebaseAuthEmulatorHost: z.ZodOptional<z.ZodString>;
    downloaderServiceUrl: z.ZodDefault<z.ZodString>;
    searchBaseServiceUrl: z.ZodDefault<z.ZodString>;
    fileGeneratorServiceUrl: z.ZodDefault<z.ZodString>;
    documentReaderServiceUrl: z.ZodDefault<z.ZodString>;
    requestTimeoutMs: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    port: number;
    nodeEnv: "development" | "production" | "test";
    projectId: string;
    downloaderServiceUrl: string;
    searchBaseServiceUrl: string;
    fileGeneratorServiceUrl: string;
    documentReaderServiceUrl: string;
    requestTimeoutMs: number;
    firestoreEmulatorHost?: string | undefined;
    firebaseAuthEmulatorHost?: string | undefined;
}, {
    port?: number | undefined;
    nodeEnv?: "development" | "production" | "test" | undefined;
    projectId?: string | undefined;
    firestoreEmulatorHost?: string | undefined;
    firebaseAuthEmulatorHost?: string | undefined;
    downloaderServiceUrl?: string | undefined;
    searchBaseServiceUrl?: string | undefined;
    fileGeneratorServiceUrl?: string | undefined;
    documentReaderServiceUrl?: string | undefined;
    requestTimeoutMs?: number | undefined;
}>;
export type Config = z.infer<typeof configSchema>;
export declare const config: {
    port: number;
    nodeEnv: "development" | "production" | "test";
    projectId: string;
    downloaderServiceUrl: string;
    searchBaseServiceUrl: string;
    fileGeneratorServiceUrl: string;
    documentReaderServiceUrl: string;
    requestTimeoutMs: number;
    firestoreEmulatorHost?: string | undefined;
    firebaseAuthEmulatorHost?: string | undefined;
};
export {};
//# sourceMappingURL=index.d.ts.map