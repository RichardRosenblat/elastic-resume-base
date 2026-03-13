import { Request } from 'express';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  correlationId: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  correlationId?: string;
}

export interface UserProfile {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}

export interface IngestRequest {
  sheetId?: string;
  batchId?: string;
  metadata?: Record<string, unknown>;
}

export interface IngestResponse {
  jobId: string;
  status: string;
  acceptedAt: string;
}

export interface SearchRequest {
  query: string;
  filters?: Record<string, unknown>;
  limit?: number;
  offset?: number;
}

export interface SearchResult {
  id: string;
  score: number;
  data: Record<string, unknown>;
}

export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

export interface GenerateRequest {
  language: string;
  format: string;
}

export interface GenerateResponse {
  jobId: string;
  status: string;
  downloadUrl?: string;
}

export interface DocumentReadRequest {
  fileReference: string;
  options?: {
    extractTables?: boolean;
    language?: string;
  };
}

export interface DocumentReadResponse {
  text: string;
  metadata?: Record<string, unknown>;
}
