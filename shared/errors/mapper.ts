import { ErrorCategory, type ErrorCategoryId } from '@shared/types/errors'

export class AppError extends Error {
  public readonly category: ErrorCategoryId
  public readonly retryable: boolean
  public override readonly cause?: unknown

  constructor(category: ErrorCategoryId, message: string, cause?: unknown, retryable = false) {
    super(message)
    this.name = 'AppError'
    this.category = category
    this.retryable = retryable
    if (cause !== undefined) {
      this.cause = cause
    }
  }
}

const NETWORK_CODES = new Set(['ENOTFOUND', 'ENETUNREACH', 'EAI_AGAIN'])
const CONNECTION_CODES = new Set(['ECONNREFUSED', 'ETIMEDOUT', 'ECONNRESET', 'EHOSTUNREACH'])
const TLS_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'ERR_TLS_CERT_ALTNAME_INVALID',
])

function extractCode(err: unknown): string | undefined {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code: unknown }).code
    if (typeof code === 'string') {
      return code
    }
  }
  return undefined
}

function extractStatus(err: unknown): number | undefined {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status: unknown }).status
    if (typeof status === 'number') {
      return status
    }
  }
  return undefined
}

export function toErrorCategory(err: unknown): ErrorCategoryId {
  if (err instanceof AppError) {
    return err.category
  }

  const code = extractCode(err)
  if (code) {
    if (NETWORK_CODES.has(code)) {
      return ErrorCategory.NetworkUnavailable
    }
    if (CONNECTION_CODES.has(code)) {
      return ErrorCategory.EndpointUnreachable
    }
    if (TLS_CODES.has(code)) {
      return ErrorCategory.TlsError
    }
  }

  const status = extractStatus(err)
  if (status !== undefined) {
    if (status === 401 || status === 403) {
      return ErrorCategory.AuthenticationFailure
    }
    if (status === 429) {
      return ErrorCategory.RateLimited
    }
    if (status === 402) {
      return ErrorCategory.QuotaExceeded
    }
    if (status === 400) {
      return ErrorCategory.InvalidProviderResponse
    }
  }

  return ErrorCategory.InternalAppError
}
