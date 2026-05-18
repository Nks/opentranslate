import {
  describe, expect, it,
} from 'vitest'
import {
  validateGoogleServiceAccountJson,
} from '@electron/services/settings/credentials-validator'

const FULL_VALID_KEY = JSON.stringify({
  type: 'service_account',
  project_id: 'my-gcp-project',
  private_key_id: 'abc123',
  private_key: '-----BEGIN PRIVATE KEY-----\nfake\n-----END PRIVATE KEY-----\n',
  client_email: 'translator@my-gcp-project.iam.gserviceaccount.com',
  client_id: '0123456789',
  token_uri: 'https://oauth2.googleapis.com/token',
})

describe('validateGoogleServiceAccountJson', () => {
  it('rejects non-JSON contents', () => {
    const result = validateGoogleServiceAccountJson('not json at all')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('JSON')
  })

  it('rejects a JSON array (root must be an object)', () => {
    const result = validateGoogleServiceAccountJson('[1, 2, 3]')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('object')
  })

  it('rejects a JSON null root', () => {
    const result = validateGoogleServiceAccountJson('null')
    expect(result.ok).toBe(false)
    expect(result.error).toContain('object')
  })

  it('rejects a service-account JSON missing client_email', () => {
    const withoutClientEmail = JSON.stringify({
      project_id: 'p',
      private_key: 'k',
    })
    const result = validateGoogleServiceAccountJson(withoutClientEmail)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('client_email')
  })

  it('rejects a service-account JSON missing private_key', () => {
    const withoutPrivateKey = JSON.stringify({
      project_id: 'p',
      client_email: 'sa@example.com',
    })
    const result = validateGoogleServiceAccountJson(withoutPrivateKey)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('private_key')
  })

  it('rejects a service-account JSON missing project_id', () => {
    const withoutProjectId = JSON.stringify({
      private_key: 'k',
      client_email: 'sa@example.com',
    })
    const result = validateGoogleServiceAccountJson(withoutProjectId)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('project_id')
  })

  it('rejects when required keys are present but empty strings', () => {
    const empty = JSON.stringify({
      project_id: '',
      private_key: '',
      client_email: '',
    })
    const result = validateGoogleServiceAccountJson(empty)
    expect(result.ok).toBe(false)
    expect(result.error).toContain('client_email')
    expect(result.error).toContain('private_key')
    expect(result.error).toContain('project_id')
  })

  it('accepts a service-account JSON containing all three required keys', () => {
    const result = validateGoogleServiceAccountJson(FULL_VALID_KEY)
    expect(result.ok).toBe(true)
    expect(result.error).toBeUndefined()
  })
})
