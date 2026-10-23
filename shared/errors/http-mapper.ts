import {
  ErrorCategory, type ErrorCategoryId,
} from '@shared/types/errors'

const MAX_PROVIDER_DETAIL_CHARS: number = 200

/**
 * Shorten provider-supplied error text before it is put in an error message
 * that reaches logs and the UI.
 */
export function truncateProviderDetail(detail: string): string {
  return detail.length > MAX_PROVIDER_DETAIL_CHARS
    ? `${detail.slice(0, MAX_PROVIDER_DETAIL_CHARS)}…`
    : detail
}

/**
 * Generic HTTP status → ErrorCategory mapping used by every provider
 * mapper. Provider-specific 400 disambiguation (e.g. Google's
 * INVALID_ARGUMENT → unsupported language) happens inside each provider's
 * own mapper, not here.
 */
export function mapHttpStatusToCategory(status: number): ErrorCategoryId {
  if (status === 401 || status === 403) {
    return ErrorCategory.AuthenticationFailure
  }

  if (status === 402) {
    return ErrorCategory.QuotaExceeded
  }

  if (status === 429) {
    return ErrorCategory.RateLimited
  }

  if (status === 400) {
    return ErrorCategory.InvalidProviderResponse
  }

  if (status === 404) {
    return ErrorCategory.EndpointUnreachable
  }

  if (status >= 500 && status < 600) {
    return ErrorCategory.EndpointUnreachable
  }

  return ErrorCategory.InvalidProviderResponse
}
