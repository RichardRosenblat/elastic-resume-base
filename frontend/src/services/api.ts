import axios from 'axios';
import type { AxiosInstance } from 'axios';
import { auth } from '../firebase';
import { config } from '../config';
import type { UserProfile, UserRecord, PreApprovedUser, ResumeIngestJob, ApiResponse } from '../types';

const apiClient: AxiosInstance = axios.create({
  baseURL: config.bffUrl,
});

apiClient.interceptors.request.use(async (reqConfig) => {
  const user = auth.currentUser;
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
    return Promise.reject(error);
  }
);

export const getMyProfile = async (): Promise<UserProfile> => {
  const res = await apiClient.get<UserProfile>('/api/v1/me');
  return res.data;
};

export const getMyUserRecord = async (): Promise<UserRecord> => {
  const res = await apiClient.get<UserRecord>('/api/v1/users/me');
  return res.data;
};

export const updateMyEmail = async (email: string): Promise<UserRecord> => {
  const res = await apiClient.patch<UserRecord>('/api/v1/users/me', { email });
  return res.data;
};

export const listUsers = async (page = 1, limit = 10): Promise<ApiResponse<UserRecord[]>> => {
  const res = await apiClient.get<ApiResponse<UserRecord[]>>('/api/v1/users', {
    params: { page, limit },
  });
  return res.data;
};

export const getUserById = async (uid: string): Promise<UserRecord> => {
  const res = await apiClient.get<UserRecord>(`/api/v1/users/${uid}`);
  return res.data;
};

export const updateUser = async (uid: string, data: Partial<UserRecord>): Promise<UserRecord> => {
  const res = await apiClient.patch<UserRecord>(`/api/v1/users/${uid}`, data);
  return res.data;
};

export const deleteUser = async (uid: string): Promise<void> => {
  await apiClient.delete(`/api/v1/users/${uid}`);
};

export const listPreApprovedUsers = async (): Promise<PreApprovedUser[]> => {
  const res = await apiClient.get<PreApprovedUser[]>('/api/v1/users/pre-approve');
  return res.data;
};

export const addPreApprovedUser = async (data: PreApprovedUser): Promise<PreApprovedUser> => {
  const res = await apiClient.post<PreApprovedUser>('/api/v1/users/pre-approve', data);
  return res.data;
};

export const deletePreApprovedUser = async (email: string): Promise<void> => {
  await apiClient.delete('/api/v1/users/pre-approve', { data: { email } });
};

export const triggerResumeIngest = async (data: { sheetId?: string; batchId?: string }): Promise<ResumeIngestJob> => {
  if (!config.features.resumeIngest) {
    return { jobId: 'mock-job-id', status: 'mock', acceptedAt: new Date().toISOString() };
  }
  const res = await apiClient.post<ResumeIngestJob>('/api/v1/resumes/ingest', data);
  return res.data;
};

export const generateResume = async (resumeId: string, data: { language: string; format: string }): Promise<Blob> => {
  if (!config.features.resumeGenerate) {
    return new Blob(['Mock PDF content'], { type: 'application/pdf' });
  }
  const res = await apiClient.post<Blob>(`/api/v1/resumes/${resumeId}/generate`, data, {
    responseType: 'blob',
  });
  return res.data;
};

export const searchResumes = async (query: string): Promise<ApiResponse<UserRecord[]>> => {
  if (!config.features.resumeSearch) {
    return { success: true, data: [] };
  }
  const res = await apiClient.post<ApiResponse<UserRecord[]>>('/api/v1/search', { query });
  return res.data;
};

export default apiClient;
