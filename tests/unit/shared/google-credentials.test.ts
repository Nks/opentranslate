import {
  describe, expect, it,
} from 'vitest'
import {
  validateGoogleCredentialsJson,
} from '@shared/providers/google-credentials'

describe('validateGoogleCredentialsJson', () => {
  it('accepts a valid service-account JSON and extracts metadata', () => {
    const text = JSON.stringify({
      type: 'service_account',
      project_id: 'my-gcp-project',
      private_key_id: 'abc',
      private_key: '-----BEGIN PRIVATE KEY-----\nMI...\n-----END PRIVATE KEY-----\n',
      client_email: 'translator@my-gcp-project.iam.gserviceaccount.com',
      client_id: '0',
    })
    const result = validateGoogleCredentialsJson(text)

    expect(result.valid).toBe(true)

    if (result.valid) {
      expect(result.projectId).toBe('my-gcp-project')
      expect(result.clientEmail).toContain('@my-gcp-project.iam.gserviceaccount.com')
    }
  })

  it('rejects malformed JSON with the parse error', () => {
    const result = validateGoogleCredentialsJson('{not-json')

    expect(result.valid).toBe(false)

    if (!result.valid) {
      expect(result.error).toMatch(/Not a JSON file/i)
    }
  })

  it('rejects a JSON array (not an object)', () => {
    const result = validateGoogleCredentialsJson('[]')

    expect(result.valid).toBe(false)

    if (!result.valid) {
      expect(result.error).toMatch(/service-account object/i)
    }
  })

  it('rejects when project_id is missing', () => {
    const text = JSON.stringify({
      client_email: 'a@b.iam.gserviceaccount.com',
      private_key: '-----BEGIN PRIVATE KEY-----\nMI...\n',
    })
    const result = validateGoogleCredentialsJson(text)

    expect(result.valid).toBe(false)

    if (!result.valid) {
      expect(result.error).toContain('project_id')
    }
  })

  it('rejects when client_email is empty', () => {
    const text = JSON.stringify({
      project_id: 'p',
      client_email: '',
      private_key: 'k',
    })
    const result = validateGoogleCredentialsJson(text)

    expect(result.valid).toBe(false)

    if (!result.valid) {
      expect(result.error).toContain('client_email')
    }
  })

  it('lists every missing field at once', () => {
    const text = JSON.stringify({
      private_key: 'k',
    })
    const result = validateGoogleCredentialsJson(text)

    expect(result.valid).toBe(false)

    if (!result.valid) {
      expect(result.error).toContain('project_id')
      expect(result.error).toContain('client_email')
    }
  })
})
