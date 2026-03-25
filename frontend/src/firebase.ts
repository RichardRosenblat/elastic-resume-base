/**
 * @file firebase.ts — Aegis client-side authentication initialisation.
 *
 * Initialises the Aegis client auth layer once with the Firebase project
 * credentials from {@link config}.  All other modules should import `auth`
 * from this file rather than calling `firebase/auth` directly, keeping every
 * Firebase dependency isolated behind the Aegis abstraction.
 */
import { initializeClientAuth, getClientAuth } from '@elastic-resume-base/aegis/client';
import { config } from './config';

initializeClientAuth({
  apiKey: config.firebase.apiKey,
  authDomain: config.firebase.authDomain,
  projectId: config.firebase.projectId,
  authEmulatorHost: config.firebase.authEmulatorHost,
});

/** The singleton {@link IClientAuth} instance for the entire application. */
export const auth = getClientAuth();
export default auth;
