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
   *
   * In api-key mode this method always throws: the API key authentication
   * path uses a `?key=` query param and never issues a bearer token.
   */
  getAccessToken: () => Promise<string>
  /**
   * Project id from the credentials file (service-account mode) or from
   * the configured `projectId` (api-key mode).
   */
  getProjectId: () => Promise<string>
  /**
   * Returns the API key when the provider is in api-key mode, otherwise
   * `null`. The http-client uses this to decide whether to append the
   * `?key=` query param.
   */
  getApiKey: () => string | null
}

export interface ServiceAccountAuthInput {
  authMode: 'service-account'
  credentialsJsonPath: string
}

export interface ApiKeyAuthInput {
  authMode: 'api-key'
  apiKey: string
  projectId: string
}

export type DefaultGoogleAuthInput = ServiceAccountAuthInput | ApiKeyAuthInput

/**
 * Default production auth provider. Returns a `service-account` flavour
 * (backed by `google-auth-library`) or an `api-key` flavour depending
 * on the input shape. Tests inject a fake `GoogleAuthProvider` instead
 * of hitting Google's token endpoint.
 */
export function createDefaultGoogleAuth(input: DefaultGoogleAuthInput): GoogleAuthProvider {
  if (input.authMode === 'api-key') {
    return createApiKeyAuthProvider(input)
  }

  return createServiceAccountAuthProvider(input)
}

function createServiceAccountAuthProvider(
  input: ServiceAccountAuthInput,
): GoogleAuthProvider {
  const auth = new GoogleAuth({
    keyFile: input.credentialsJsonPath,
    scopes: ['https://www.googleapis.com/auth/cloud-translation'],
  })

  return {
    async getAccessToken(): Promise<string> {
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
      } catch (err: unknown) {
        if (err instanceof AppError) {
          throw err
        }

        const message: string = err instanceof Error
          ? err.message
          : String(err)

        throw new AppError(
          ErrorCategory.AuthenticationFailure,
          `google: failed to obtain access token — ${message}`,
          err,
        )
      }
    },
    async getProjectId(): Promise<string> {
      try {
        return await auth.getProjectId()
      } catch (err: unknown) {
        const message: string = err instanceof Error
          ? err.message
          : String(err)

        throw new AppError(
          ErrorCategory.AuthenticationFailure,
          `google: failed to read project id — ${message}`,
          err,
        )
      }
    },
    getApiKey(): string | null {
      return null
    },
  }
}

function createApiKeyAuthProvider(input: ApiKeyAuthInput): GoogleAuthProvider {
  const projectId: string = input.projectId
  const apiKey: string = input.apiKey

  return {
    async getAccessToken(): Promise<string> {
      throw new AppError(
        ErrorCategory.AuthenticationFailure,
        'google: api-key mode does not issue bearer tokens — caller must use the ?key= query parameter',
      )
    },
    async getProjectId(): Promise<string> {
      return projectId
    },
    getApiKey(): string | null {
      return apiKey
    },
  }
}
