import {
  describe, expect, it,
} from 'vitest'
import {
  mapHttpStatusToCategory,
} from '@shared/errors/http-mapper'
import {
  ErrorCategory,
} from '@shared/types/errors'

describe('mapHttpStatusToCategory', () => {
  it('maps 401 and 403 to authentication_failure', () => {
    expect(mapHttpStatusToCategory(401)).toBe(ErrorCategory.AuthenticationFailure)
    expect(mapHttpStatusToCategory(403)).toBe(ErrorCategory.AuthenticationFailure)
  })

  it('maps 402 to quota_exceeded', () => {
    expect(mapHttpStatusToCategory(402)).toBe(ErrorCategory.QuotaExceeded)
  })

  it('maps 429 to rate_limited', () => {
    expect(mapHttpStatusToCategory(429)).toBe(ErrorCategory.RateLimited)
  })

  it('maps 400 to invalid_provider_response by default', () => {
    expect(mapHttpStatusToCategory(400)).toBe(ErrorCategory.InvalidProviderResponse)
  })

  it('maps 404 to endpoint_unreachable', () => {
    expect(mapHttpStatusToCategory(404)).toBe(ErrorCategory.EndpointUnreachable)
  })

  it('maps 5xx family to endpoint_unreachable', () => {
    expect(mapHttpStatusToCategory(500)).toBe(ErrorCategory.EndpointUnreachable)
    expect(mapHttpStatusToCategory(502)).toBe(ErrorCategory.EndpointUnreachable)
    expect(mapHttpStatusToCategory(503)).toBe(ErrorCategory.EndpointUnreachable)
    expect(mapHttpStatusToCategory(504)).toBe(ErrorCategory.EndpointUnreachable)
  })

  it('falls back to invalid_provider_response for unexpected status', () => {
    expect(mapHttpStatusToCategory(418)).toBe(ErrorCategory.InvalidProviderResponse)
  })
})
