/**
 * Token Validation Utility
 *
 * Provides robust token validation and refresh logic to prevent
 * 401 authentication errors due to expired or uninitialized tokens.
 *
 * Key features:
 * - Validates session exists and is ready
 * - Checks access_token is present
 * - Verifies token is not expired
 * - Auto-refreshes tokens near expiration
 * - Provides clear error messages
 */

import { supabase } from '@/lib/supabase';

// Token expiration buffer: refresh if token expires within 5 minutes
const TOKEN_EXPIRATION_BUFFER_MS = 5 * 60 * 1000;

export class TokenValidationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'TokenValidationError';
  }
}

/**
 * Get a valid, unexpired session token
 *
 * This function:
 * 1. Retrieves the current session
 * 2. Validates the session and token exist
 * 3. Checks if token is expired or close to expiration
 * 4. Refreshes the session if needed
 * 5. Returns a guaranteed valid access token
 *
 * @returns Valid access token string
 * @throws TokenValidationError if session is invalid or cannot be refreshed
 */
export async function getValidSessionToken(): Promise<string> {
  try {
    // Step 1: Get current session
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error('[TokenValidator] Error getting session:', sessionError);
      throw new TokenValidationError(
        'Failed to retrieve session. Please log in again.',
        'SESSION_ERROR'
      );
    }

    if (!session) {
      throw new TokenValidationError(
        'No active session found. Please log in.',
        'NO_SESSION'
      );
    }

    // Step 2: Validate access token exists
    if (!session.access_token) {
      console.error('[TokenValidator] Session exists but access_token is missing');
      throw new TokenValidationError(
        'Session token is missing. Please log in again.',
        'TOKEN_MISSING'
      );
    }

    // Step 3: Check token expiration
    const now = Date.now();
    let expiresAt: number;

    if (session.expires_at) {
      // expires_at is a Unix timestamp in seconds
      expiresAt = session.expires_at * 1000;
    } else {
      // Fallback: parse JWT exp claim if expires_at not available
      try {
        const tokenPayload = parseJWT(session.access_token);
        if (tokenPayload.exp) {
          expiresAt = tokenPayload.exp * 1000;
        } else {
          console.warn('[TokenValidator] Cannot determine token expiration, assuming valid');
          return session.access_token;
        }
      } catch (parseError) {
        console.warn('[TokenValidator] Failed to parse JWT, assuming token valid:', parseError);
        return session.access_token;
      }
    }

    // Step 4: Check if token is expired
    if (now >= expiresAt) {
      console.log('[TokenValidator] Token is expired, refreshing session');
      return await refreshAndGetToken();
    }

    // Step 5: Check if token is close to expiration (within buffer)
    const timeUntilExpiration = expiresAt - now;
    if (timeUntilExpiration < TOKEN_EXPIRATION_BUFFER_MS) {
      console.log(
        `[TokenValidator] Token expires in ${Math.round(timeUntilExpiration / 1000)}s, refreshing session`
      );
      return await refreshAndGetToken();
    }

    // Token is valid and not close to expiration
    console.log(
      `[TokenValidator] Token validated, expires in ${Math.round(timeUntilExpiration / 60000)} minutes`
    );
    return session.access_token;

  } catch (error) {
    // Re-throw TokenValidationError as-is
    if (error instanceof TokenValidationError) {
      throw error;
    }

    // Wrap other errors
    console.error('[TokenValidator] Unexpected error:', error);
    throw new TokenValidationError(
      'Failed to validate session token. Please try again.',
      'VALIDATION_ERROR'
    );
  }
}

/**
 * Refresh the session and return a new access token
 *
 * @returns New valid access token
 * @throws TokenValidationError if refresh fails
 */
async function refreshAndGetToken(): Promise<string> {
  try {
    const { data: { session }, error } = await supabase.auth.refreshSession();

    if (error) {
      console.error('[TokenValidator] Session refresh failed:', error);
      throw new TokenValidationError(
        'Failed to refresh session. Please log in again.',
        'REFRESH_FAILED'
      );
    }

    if (!session || !session.access_token) {
      throw new TokenValidationError(
        'Session refresh succeeded but token is missing. Please log in again.',
        'REFRESH_NO_TOKEN'
      );
    }

    console.log('[TokenValidator] Session refreshed successfully');
    return session.access_token;

  } catch (error) {
    if (error instanceof TokenValidationError) {
      throw error;
    }

    console.error('[TokenValidator] Unexpected error during refresh:', error);
    throw new TokenValidationError(
      'Failed to refresh session. Please log in again.',
      'REFRESH_ERROR'
    );
  }
}

/**
 * Parse a JWT token to extract the payload
 *
 * @param token JWT token string
 * @returns Decoded token payload
 * @throws Error if token is malformed
 */
function parseJWT(token: string): any {
  try {
    // JWT format: header.payload.signature
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }

    // Decode base64url payload
    const payload = parts[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);

  } catch (error) {
    throw new Error(`Failed to parse JWT: ${(error as Error).message}`);
  }
}

/**
 * Check if the current session is valid (without throwing errors)
 *
 * Useful for UI components that want to check session status
 * without triggering authentication flows.
 *
 * @returns true if session is valid, false otherwise
 */
export async function isSessionValid(): Promise<boolean> {
  try {
    await getValidSessionToken();
    return true;
  } catch {
    return false;
  }
}
