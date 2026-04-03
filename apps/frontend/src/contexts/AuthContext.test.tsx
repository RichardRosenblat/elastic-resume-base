/**
 * @file AuthContext.test.tsx — Unit tests for AuthContext / AuthProvider.
 *
 * Focuses on the fetchUserProfile helper that fires during onAuthStateChanged.
 * Verifies that a UUID v4 x-correlation-id header is attached to every
 * profile-fetch request so the backend can trace it end-to-end.
 */
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Module mocks (must be hoisted before imports) ───────────────────────────

// Use vi.hoisted so mock factories can reference these mutable spies.
const { mockAxiosGet, mockOnAuthStateChanged } = vi.hoisted(() => ({
  mockAxiosGet: vi.fn(),
  mockOnAuthStateChanged: vi.fn(),
}));

// Provide a minimal axios mock so the test never loads the real axios bundle
// and the `AuthContext.tsx` import chain stays lightweight.
vi.mock('axios', () => ({
  default: {
    get: mockAxiosGet,
    isAxiosError: (e: unknown): boolean =>
      typeof e === 'object' && e !== null && (e as { isAxiosError?: boolean }).isAxiosError === true,
  },
}));

// Prevent the Firebase SDK from loading — aegis/client re-exports FirebaseClientAuth
// which imports firebase/app and firebase/auth (49 MB) and causes OOM in jsdom tests.
vi.mock('@elastic-resume-base/aegis/client', () => ({
  initializeClientAuth: vi.fn(),
  getClientAuth: vi.fn(() => ({
    onAuthStateChanged: mockOnAuthStateChanged,
    signOut: vi.fn(),
    getCurrentUser: () => null,
  })),
}));

vi.mock('../firebase', () => ({
  auth: {
    onAuthStateChanged: mockOnAuthStateChanged,
    signOut: vi.fn(),
    getCurrentUser: () => null,
  },
  default: {
    onAuthStateChanged: mockOnAuthStateChanged,
    signOut: vi.fn(),
    getCurrentUser: () => null,
  },
}));

vi.mock('../config', () => ({
  config: {
    gatewayApiUrl: 'http://localhost:3000',
    features: {
      resumeIngest: false,
      resumeSearch: false,
      documentRead: false,
      resumeGenerate: false,
    },
    firebase: {
      apiKey: 'test-key',
      authDomain: 'test.firebaseapp.com',
      projectId: 'test-project',
      authEmulatorHost: undefined,
    },
  },
}));

vi.mock('react-i18next', () => {
  // Use a stable function reference so that components with useEffect deps on
  // `t` don't re-run the effect on every render (which would cause infinite loops).
  const tFn = (key: string) => key;
  return {
    useTranslation: () => ({
      t: tFn,
      i18n: { language: 'en' },
    }),
  };
});

vi.mock('./use-toast', () => {
  // Use a stable showToast reference so that components with useEffect deps on
  // `showToast` don't re-run the effect on every render (which would cause infinite loops).
  const showToastFn = vi.fn();
  return {
    useToast: () => ({ showToast: showToastFn }),
  };
});

// ─── Imports after mocks ──────────────────────────────────────────────────────

import { AuthProvider } from './AuthContext';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const UUID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type MockUser = {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL: string | null;
  getIdToken: ReturnType<typeof vi.fn>;
};

function makeUser(uid = 'user-123', email = 'user@example.com'): MockUser {
  return {
    uid,
    email,
    displayName: 'Test User',
    photoURL: null,
    getIdToken: vi.fn().mockResolvedValue('test-id-token'),
  };
}

function makeProfile(uid = 'user-123', email = 'user@example.com') {
  return { uid, email, name: 'Test User', role: 'user' as const, enable: true };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AuthProvider — fetchUserProfile correlation ID', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('attaches a UUID v4 x-correlation-id header when fetching the user profile', async () => {
    mockAxiosGet.mockResolvedValue({ data: { data: makeProfile() } });
    mockOnAuthStateChanged.mockImplementation((callback: (user: MockUser | null) => void) => {
      callback(makeUser());
      return () => {};
    });

    render(<AuthProvider><div /></AuthProvider>);

    await waitFor(() => {
      expect(mockAxiosGet).toHaveBeenCalled();
    });

    const [, requestConfig] = mockAxiosGet.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(requestConfig.headers['x-correlation-id']).toMatch(UUID_V4_RE);
  });

  it('does NOT attach an x-cloud-trace-context header to the profile fetch', async () => {
    mockAxiosGet.mockResolvedValue({ data: { data: makeProfile('user-789', 'trace@example.com') } });
    mockOnAuthStateChanged.mockImplementation((callback: (user: MockUser | null) => void) => {
      callback(makeUser('user-789', 'trace@example.com'));
      return () => {};
    });

    render(<AuthProvider><div /></AuthProvider>);

    await waitFor(() => {
      expect(mockAxiosGet).toHaveBeenCalled();
    });

    const [, requestConfig] = mockAxiosGet.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(requestConfig.headers['x-cloud-trace-context']).toBeUndefined();
  });
});
