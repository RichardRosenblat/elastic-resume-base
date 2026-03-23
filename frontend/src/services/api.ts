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
  ResumeIngestJob,
  ResumeGenerateJob,
  SearchResponseData,
  ListUsersData,
  SuccessResponse,
} from '../types';

const apiClient: AxiosInstance = axios.create({
  baseURL: config.bffUrl,
});

apiClient.interceptors.request.use(async (reqConfig) => {
  const user = auth.getCurrentUser();
  if (user) {
    const token = await user.getIdToken();
    reqConfig.headers.Authorization = `Bearer ${token}`;
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

/** Updates the authenticated user's own email address (`PATCH /api/v1/users/me`). */
export const updateMyEmail = async (email: string): Promise<UserRecord> => {
  const res = await apiClient.patch<SuccessResponse<UserRecord>>('/api/v1/users/me', { email });
  return unwrapSuccessResponse(res.data);
};

/**
 * Returns a paginated list of all users. Admin only.
 * @param page  1-based page number (default: 1).
 * @param limit Items per page (default: 10).
 */
export const listUsers = async (_page = 1, limit = 10): Promise<SuccessResponse<ListUsersData>> => {
  const res = await apiClient.get<SuccessResponse<ListUsersData>>('/api/v1/users', {
    params: { maxResults: limit },
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
export const listPreApprovedUsers = async (): Promise<PreApprovedUser[]> => {
  const res = await apiClient.get<SuccessResponse<PreApprovedUser[]>>('/api/v1/users/pre-approve');
  return unwrapSuccessResponse(res.data);
};

/** Adds an email address to the pre-approved list. Admin only. */
export const addPreApprovedUser = async (data: PreApprovedUser): Promise<PreApprovedUser> => {
  const res = await apiClient.post<SuccessResponse<PreApprovedUser>>('/api/v1/users/pre-approve', data);
  return unwrapSuccessResponse(res.data);
};

/** Removes an email address from the pre-approved list. Admin only. */
export const deletePreApprovedUser = async (email: string): Promise<void> => {
  await apiClient.delete('/api/v1/users/pre-approve', { data: { email } });
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

export default apiClient;
