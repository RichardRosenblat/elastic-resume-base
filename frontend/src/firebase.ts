/**
 * Firebase application and Auth initialisation.
 *
 * The Firebase app is created once from the VITE_ environment variables
 * collected in {@link config}. The Auth instance is exported so that other
 * modules (AuthContext, api.ts) can call `auth.currentUser` or `getIdToken()`
 * without instantiating a second app.
 */
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { config } from './config';

const app = initializeApp(config.firebase);
export const auth = getAuth(app);
export default app;
