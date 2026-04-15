import { describe, expect, it } from 'vitest'
import { AppError, ErrorCategory, toErrorCategory } from '@shared/errors'

describe('toErrorCategory', () => {
  it('returns category from AppError directly', () => {
    const err = new AppError(ErrorCategory.AuthenticationFailure, 'nope')
    expect(toErrorCategory(err)).toBe(ErrorCategory.AuthenticationFailure)
  })

  it('maps node DNS errors to network_unavailable', () => {
    for (const code of ['ENOTFOUND', 'EAI_AGAIN', 'ENETUNREACH']) {
      const err = Object.assign(new Error('dns'), { code })
      expect(toErrorCategory(err)).toBe(ErrorCategory.NetworkUnavailable)
    }
  })

  it('maps connection errors to endpoint_unreachable', () => {
    for (const code of ['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET']) {
      const err = Object.assign(new Error('conn'), { code })
      expect(toErrorCategory(err)).toBe(ErrorCategory.EndpointUnreachable)
    }
  })

  it('maps TLS errors to tls_error', () => {
    for (const code of [
      'CERT_HAS_EXPIRED',
      'DEPTH_ZERO_SELF_SIGNED_CERT',
      'SELF_SIGNED_CERT_IN_CHAIN',
      'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
    ]) {
      const err = Object.assign(new Error('tls'), { code })
      expect(toErrorCategory(err)).toBe(ErrorCategory.TlsError)
    }
  })

  it('maps 401/403 HTTP-like errors to authentication_failure', () => {
    expect(toErrorCategory({ status: 401 })).toBe(ErrorCategory.AuthenticationFailure)
    expect(toErrorCategory({ status: 403 })).toBe(ErrorCategory.AuthenticationFailure)
  })

  it('maps 429 HTTP-like errors to rate_limited', () => {
    expect(toErrorCategory({ status: 429 })).toBe(ErrorCategory.RateLimited)
  })

  it('maps 402 HTTP-like errors to quota_exceeded', () => {
    expect(toErrorCategory({ status: 402 })).toBe(ErrorCategory.QuotaExceeded)
  })

  it('falls back to internal_app_error for unknown input', () => {
    expect(toErrorCategory(null)).toBe(ErrorCategory.InternalAppError)
    expect(toErrorCategory(undefined)).toBe(ErrorCategory.InternalAppError)
    expect(toErrorCategory('random string')).toBe(ErrorCategory.InternalAppError)
    expect(toErrorCategory(new Error('unknown'))).toBe(ErrorCategory.InternalAppError)
  })
})

describe('AppError', () => {
  it('carries category, message, cause, retryable', () => {
    const cause = new Error('origin')
    const err = new AppError(ErrorCategory.RateLimited, 'slow down', cause, true)
    expect(err).toBeInstanceOf(Error)
    expect(err.name).toBe('AppError')
    expect(err.category).toBe(ErrorCategory.RateLimited)
    expect(err.message).toBe('slow down')
    expect(err.cause).toBe(cause)
    expect(err.retryable).toBe(true)
  })

  it('defaults retryable to false', () => {
    const err = new AppError(ErrorCategory.InternalAppError, 'boom')
    expect(err.retryable).toBe(false)
  })
})
