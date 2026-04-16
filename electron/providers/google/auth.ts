import {
  GoogleAuth,
} from 'google-auth-library'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

export interface GoogleAuthProvider {
  /**
   * Returns a short-lived OAuth2 Bearer access token for the Cloud
   * Translation API. Caller prepends "Bearer " to the Authorization header.
   */
  getAccessToken: () => Promise<string>
  /**
   * Project id from the credentials file. Needed for v3 (Advanced) URLs.
   */
  getProjectId: () => Promise<string>
}

export interface DefaultGoogleAuthInput {
  credentialsJsonPath: string
}

/**
 * Default production auth provider backed by google-auth-library. Tests
 * inject a fake implementation of `GoogleAuthProvider` instead of hitting
 * Google's token endpoint.
 */
export function createDefaultGoogleAuth(input: DefaultGoogleAuthInput): GoogleAuthProvider {
  const auth = new GoogleAuth({
    keyFile: input.credentialsJsonPath,
    scopes: ['https://www.googleapis.com/auth/cloud-translation'],
  })

  return {
    async getAccessToken() {
      try {
        const client = await auth.getClient()
        const token = await client.getAccessToken()

        if (!token.token) {
          throw new AppError(
            ErrorCategory.AuthenticationFailure,
            'google: no access token returned by auth client',
          )
        }

        return token.token
      } catch (err) {
        if (err instanceof AppError) {
          throw err
        }

        throw new AppError(
          ErrorCategory.AuthenticationFailure,
          `google: failed to obtain access token — ${(err as Error).message ?? String(err)}`,
          err,
        )
      }
    },
    async getProjectId() {
      try {
        return await auth.getProjectId()
      } catch (err) {
        throw new AppError(
          ErrorCategory.AuthenticationFailure,
          `google: failed to read project id — ${(err as Error).message ?? String(err)}`,
          err,
        )
      }
    },
  }
}
