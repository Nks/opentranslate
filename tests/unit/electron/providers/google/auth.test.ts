import {
  describe, expect, it, vi, beforeEach,
} from 'vitest'
import {
  AppError, ErrorCategory,
} from '@shared/errors'

interface FakeClient {
  getAccessToken: () => Promise<{ token: string | null }>
}

interface FakeGoogleAuthInstance {
  getClient: () => Promise<FakeClient>
  getProjectId: () => Promise<string>
}

const googleAuthMock = vi.fn<(opts: unknown) => FakeGoogleAuthInstance>()

vi.mock('google-auth-library', () => ({
  GoogleAuth: function GoogleAuth(opts: unknown): FakeGoogleAuthInstance {
    return googleAuthMock(opts)
  },
}))

beforeEach(() => {
  googleAuthMock.mockReset()
})

const { createDefaultGoogleAuth } = await import('@electron/providers/google/auth')

describe('createDefaultGoogleAuth — service-account mode', () => {
  it('builds GoogleAuth with the picked keyFile and the cloud-translation scope', async () => {
    googleAuthMock.mockReturnValue({
      getClient: async () => ({
        getAccessToken: async () => ({
          token: 'sa-token',
        }),
      }),
      getProjectId: async () => 'sa-project',
    })

    const provider = createDefaultGoogleAuth({
      authMode: 'service-account',
      credentialsJsonPath: '/tmp/creds.json',
    })

    expect(googleAuthMock).toHaveBeenCalledWith({
      keyFile: '/tmp/creds.json',
      scopes: ['https://www.googleapis.com/auth/cloud-translation'],
    })

    const token = await provider.getAccessToken()
    expect(token).toBe('sa-token')

    const projectId = await provider.getProjectId()
    expect(projectId).toBe('sa-project')

    expect(provider.getApiKey()).toBeNull()
  })

  it('maps a missing token into AuthenticationFailure', async () => {
    googleAuthMock.mockReturnValue({
      getClient: async () => ({
        getAccessToken: async () => ({
          token: null,
        }),
      }),
      getProjectId: async () => 'sa-project',
    })

    const provider = createDefaultGoogleAuth({
      authMode: 'service-account',
      credentialsJsonPath: '/tmp/creds.json',
    })

    try {
      await provider.getAccessToken()
      expect.fail('expected getAccessToken to throw')
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).category).toBe(ErrorCategory.AuthenticationFailure)
    }
  })
})

describe('createDefaultGoogleAuth — api-key mode', () => {
  it('returns the api key from getApiKey() and never touches GoogleAuth', () => {
    const provider = createDefaultGoogleAuth({
      authMode: 'api-key',
      apiKey: 'AIza-key',
      projectId: 'explicit-project',
    })

    expect(googleAuthMock).not.toHaveBeenCalled()
    expect(provider.getApiKey()).toBe('AIza-key')
  })

  it('throws AuthenticationFailure when getAccessToken() is called', async () => {
    const provider = createDefaultGoogleAuth({
      authMode: 'api-key',
      apiKey: 'AIza-key',
      projectId: 'explicit-project',
    })

    try {
      await provider.getAccessToken()
      expect.fail('expected api-key mode to refuse bearer token issuance')
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(AppError)
      expect((err as AppError).category).toBe(ErrorCategory.AuthenticationFailure)
    }
  })

  it('returns the configured projectId from getProjectId()', async () => {
    const provider = createDefaultGoogleAuth({
      authMode: 'api-key',
      apiKey: 'AIza-key',
      projectId: 'explicit-project',
    })

    expect(await provider.getProjectId()).toBe('explicit-project')
  })
})
