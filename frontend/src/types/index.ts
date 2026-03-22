export interface UserProfile {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
  role: 'admin' | 'user';
  enable: boolean;
}

export interface UserRecord {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  enable: boolean;
}

export interface PreApprovedUser {
  email: string;
  role: 'admin' | 'user';
}

export interface ResumeIngestJob {
  jobId: string;
  status: string;
  acceptedAt: string;
}

export interface ApiMeta {
  page: number;
  limit: number;
  total: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: ApiMeta;
}

export interface FeatureFlags {
  resumeIngest: boolean;
  resumeSearch: boolean;
  documentRead: boolean;
  resumeGenerate: boolean;
  userManagement: boolean;
}
