/**
 * @file api.ts — Axios client and BFF Gateway API call functions.
 *
 * All HTTP requests from the frontend flow through this module. The Axios
 * instance automatically attaches the Firebase ID token as a `Bearer` header
 * on every request and signs the user out if the server returns a 401.
 *
 * Functions that depend on backend features that may not be deployed yet
 * (resume ingest, generate, search) return mock data when the corresponding
 * feature flag is disabled, so the UI stays functional during development.
 */
import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { auth } from '../firebase';
import { config } from '../config';
import { ensureApiRequestError } from './api-error';
import type {
  UserRecord,
  PreApprovedUser,
  UserSortField,
  PreApprovedSortField,
  SortDirection,
  ResumeIngestJob,
  ResumeGenerateJob,
  SearchResponseData,
  ListUsersData,
  SuccessResponse,
} from '../types';

const apiClient: AxiosInstance = axios.create({
  baseURL: config.bffUrl,
});

const REQUEST_WINDOW_MS = 10_000;
const MAX_REQUESTS_PER_WINDOW = 40;
const DUPLICATE_GET_BLOCK_WINDOW_MS = 800;
const ALLOWED_RAPID_DUPLICATE_GETS = 2;

const recentRequestTimestamps: number[] = [];
const recentGetRequestBySignature = new Map<string, { count: number; lastTimestamp: number }>();

function pruneOldRequestTimestamps(now: number): void {
  const cutoff = now - REQUEST_WINDOW_MS;
  while (recentRequestTimestamps.length > 0 && recentRequestTimestamps[0] < cutoff) {
    recentRequestTimestamps.shift();
  }
}

function pruneOldGetSignatures(now: number): void {
  const cutoff = now - REQUEST_WINDOW_MS;
  recentGetRequestBySignature.forEach((entry, signature) => {
    if (entry.lastTimestamp < cutoff) {
      recentGetRequestBySignature.delete(signature);
    }
  });
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getRequestSignature(reqConfig: { method?: string; url?: string; params?: unknown; data?: unknown }): string {
  const method = (reqConfig.method ?? 'get').toUpperCase();
  const url = reqConfig.url ?? '';
  const params = safeStringify(reqConfig.params ?? {});
  const data = safeStringify(reqConfig.data ?? {});
  return `${method}:${url}:${params}:${data}`;
}

function getRequestBlockReason(reqConfig: { method?: string; url?: string; params?: unknown; data?: unknown }): string | null {
  const now = Date.now();
  pruneOldRequestTimestamps(now);
  pruneOldGetSignatures(now);

  if (recentRequestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
    return 'Too many requests in a short period. Please wait and try again.';
  }

  recentRequestTimestamps.push(now);

  const method = (reqConfig.method ?? 'get').toUpperCase();
  if (method === 'GET') {
    const signature = getRequestSignature(reqConfig);
    const previousEntry = recentGetRequestBySignature.get(signature);
    const isRapidDuplicate = previousEntry !== undefined
      && now - previousEntry.lastTimestamp < DUPLICATE_GET_BLOCK_WINDOW_MS;
    const nextCount = isRapidDuplicate ? previousEntry.count + 1 : 1;

    if (nextCount > ALLOWED_RAPID_DUPLICATE_GETS) {
      return 'Duplicate request blocked to prevent rapid repeat calls.';
    }

    recentGetRequestBySignature.set(signature, {
      count: nextCount,
      lastTimestamp: now,
    });
  }

  return null;
}

apiClient.interceptors.request.use(async (reqConfig) => {
  const user = auth.getCurrentUser();
  if (user) {
    const token = await user.getIdToken();
    reqConfig.headers.Authorization = `Bearer ${token}`;
  }

  const blockReason = getRequestBlockReason(reqConfig);
  if (blockReason) {
    return Promise.reject(ensureApiRequestError(new Error(blockReason), blockReason));
  }

  return reqConfig;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        void auth.signOut();
      }
      if (error.response?.status === 429) {
        const apiError = ensureApiRequestError(error, 'Too many requests. Please wait a moment and try again.');
        window.dispatchEvent(new CustomEvent('api:ratelimit', { detail: apiError }));
      }
    }
    return Promise.reject(ensureApiRequestError(error, 'Request failed'));
  }
);

function unwrapSuccessResponse<T>(payload: SuccessResponse<T> | T): T {
  if (
    payload !== null
    && typeof payload === 'object'
    && 'success' in payload
    && 'data' in payload
  ) {
    return (payload as SuccessResponse<T>).data;
  }

  return payload as T;
}

/** Fetches the authenticated user's full record from the Users API via BFF (`GET /api/v1/users/me`). */
export const getMyUserRecord = async (): Promise<UserRecord> => {
  const res = await apiClient.get<SuccessResponse<UserRecord>>('/api/v1/users/me');
  return unwrapSuccessResponse(res.data);
};

/**
 * Returns a paginated list of all users. Admin only.
 * @param page  1-based page number (default: 1).
 * @param limit Items per page (default: 10).
 */
export const listUsers = async (
  _page = 1,
  limit = 10,
  options?: {
    email?: string;
    role?: 'admin' | 'user';
    enable?: boolean;
    orderBy?: UserSortField;
    orderDirection?: SortDirection;
  },
): Promise<SuccessResponse<ListUsersData>> => {
  void _page;
  const res = await apiClient.get<SuccessResponse<ListUsersData>>('/api/v1/users', {
    params: {
      maxResults: limit,
      email: options?.email,
      role: options?.role,
      enable: options?.enable,
      orderBy: options?.orderBy,
      orderDirection: options?.orderDirection,
    },
  });
  return res.data;
};

/** Fetches a single user record by UID. Admin only. */
export const getUserById = async (uid: string): Promise<UserRecord> => {
  const res = await apiClient.get<SuccessResponse<UserRecord>>(`/api/v1/users/${uid}`);
  return unwrapSuccessResponse(res.data);
};

/**
 * Updates a user record. Admin can update any field; regular users can only
 * update their own email.
 */
export const updateUser = async (uid: string, data: Partial<UserRecord>): Promise<UserRecord> => {
  const res = await apiClient.patch<SuccessResponse<UserRecord>>(`/api/v1/users/${uid}`, data);
  return unwrapSuccessResponse(res.data);
};

/** Deletes a user by UID. Admin only. */
export const deleteUser = async (uid: string): Promise<void> => {
  await apiClient.delete(`/api/v1/users/${uid}`);
};

/** Returns all pre-approved email entries. Admin only. */
export const listPreApprovedUsers = async (options?: {
  role?: 'admin' | 'user';
  orderBy?: PreApprovedSortField;
  orderDirection?: SortDirection;
}): Promise<PreApprovedUser[]> => {
  const res = await apiClient.get<SuccessResponse<PreApprovedUser[]>>('/api/v1/users/pre-approve', {
    params: {
      role: options?.role,
      orderBy: options?.orderBy,
      orderDirection: options?.orderDirection,
    },
  });
  return unwrapSuccessResponse(res.data);
};

/** Adds an email address to the pre-approved list. Admin only. */
export const addPreApprovedUser = async (data: PreApprovedUser): Promise<PreApprovedUser> => {
  const res = await apiClient.post<SuccessResponse<PreApprovedUser>>('/api/v1/users/pre-approve', data);
  return unwrapSuccessResponse(res.data);
};

/** Removes an email address from the pre-approved list. Admin only. */
export const deletePreApprovedUser = async (email: string): Promise<void> => {
  await apiClient.delete('/api/v1/users/pre-approve', { params: { email } });
};

/** Updates a pre-approved user's role. Admin only. */
export const updatePreApprovedUser = async (email: string, role: 'admin' | 'user'): Promise<PreApprovedUser> => {
  const res = await apiClient.patch<SuccessResponse<PreApprovedUser>>(
    '/api/v1/users/pre-approve',
    { role },
    { params: { email } },
  );
  return unwrapSuccessResponse(res.data);
};

/**
 * Submits a resume ingest job to the BFF.
 * Returns mock data when `config.features.resumeIngest` is `false`.
 */
export const triggerResumeIngest = async (data: { sheetId?: string; batchId?: string }): Promise<ResumeIngestJob> => {
  if (!config.features.resumeIngest) {
    return { jobId: 'mock-job-id', status: 'mock', acceptedAt: new Date().toISOString() };
  }
  const res = await apiClient.post<SuccessResponse<ResumeIngestJob>>('/api/v1/resumes/ingest', data);
  return unwrapSuccessResponse(res.data);
};

/**
 * Triggers resume generation and returns the accepted job metadata.
 * Returns mock job data when `config.features.resumeGenerate` is `false`.
 *
 * @param resumeId The Firestore resume document ID.
 * @param data     Language and output format options.
 */
export const generateResume = async (
  resumeId: string,
  data: { language: string; format: string },
): Promise<ResumeGenerateJob> => {
  if (!config.features.resumeGenerate) {
    return { jobId: 'mock-generate-job-id', status: 'mock' };
  }
  const res = await apiClient.post<SuccessResponse<ResumeGenerateJob>>(`/api/v1/resumes/${resumeId}/generate`, data);
  return unwrapSuccessResponse(res.data);
};

/**
 * Performs a semantic search over indexed resumes.
 * Returns an empty result set when `config.features.resumeSearch` is `false`.
 *
 * @param query Natural-language search string.
 */
export const searchResumes = async (query: string): Promise<SuccessResponse<SearchResponseData>> => {
  if (!config.features.resumeSearch) {
    return {
      success: true,
      data: { results: [], total: 0, query },
      meta: { timestamp: new Date().toISOString() },
    };
  }
  const res = await apiClient.post<SuccessResponse<SearchResponseData>>('/api/v1/search', { query });
  return res.data;
};

/**
 * Uploads one or more documents for OCR processing via the BFF.
 * Returns a Blob containing the generated Excel workbook (.xlsx).
 * Returns an empty Blob when `config.features.documentRead` is `false`.
 *
 * @param files An array of File objects to process with OCR.
 */
export const ocrDocuments = async (files: File[]): Promise<Blob> => {
  if (!config.features.documentRead) {
    return new Blob([], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const res = await apiClient.post<Blob>('/api/v1/documents/ocr', formData, {
    responseType: 'blob',
  });
  return res.data;
};

export default apiClient;
