import {
  ErrorCategory, type ErrorCategoryId,
} from '@shared/types/errors'

const FRIENDLY_BY_CATEGORY: Record<ErrorCategoryId, string> = {
  [ErrorCategory.NetworkUnavailable]:
    'No network connection. Check your internet and try again.',
  [ErrorCategory.EndpointUnreachable]:
    'Could not reach the translation provider. Check the endpoint URL in Settings.',
  [ErrorCategory.TlsError]:
    'TLS certificate problem with the provider. Verify the certificate or enable self-signed TLS for this provider.',
  [ErrorCategory.AuthenticationFailure]:
    'Provider rejected the credentials. Check Settings → Providers.',
  [ErrorCategory.UnsupportedLanguage]:
    'The selected language is not supported by this provider.',
  [ErrorCategory.UnsupportedDocumentType]:
    'This file type is not supported for translation.',
  [ErrorCategory.QuotaExceeded]:
    'Translation quota exceeded for this provider.',
  [ErrorCategory.RateLimited]:
    'Provider rate-limited the request. Wait a moment and retry.',
  [ErrorCategory.InvalidProviderResponse]:
    'Provider returned an unexpected response.',
  [ErrorCategory.InternalAppError]:
    'Something went wrong. See details for the underlying error.',
}

const IPC_WRAPPER_RE = /^Error invoking remote method ['"][^'"]+['"]:\s*(?:Error:\s*)?/
const CATEGORY_PREFIX_RE = /^\[([a-z_]+)\]\s*/
const APPERROR_PREFIX_RE = /^AppError:\s*/
const HINT_RE = /\s—\s+(.+)$/

const KNOWN_CATEGORIES = new Set<string>(Object.values(ErrorCategory))

export interface FormattedError {
  short: string
  detail: string
  category: ErrorCategoryId | 'unknown'
}

export function stripIpcWrapper(message: string): string {
  return message.replace(IPC_WRAPPER_RE, '')
}

export function isKnownCategory(id: string): id is ErrorCategoryId {
  return KNOWN_CATEGORIES.has(id)
}

export function extractProviderHint(message: string): string | null {
  const match = message.match(HINT_RE)

  if (!match?.[1]) {
    return null
  }

  return match[1].trim()
}

export function formatErrorMessage(err: unknown): FormattedError {
  const raw = err instanceof Error ? err.message : String(err)
  const stripped = stripIpcWrapper(raw)
  const categoryMatch = stripped.match(CATEGORY_PREFIX_RE)
  const rawCategoryId = categoryMatch?.[1] ?? ''
  const category: ErrorCategoryId | 'unknown' =
    isKnownCategory(rawCategoryId) ? rawCategoryId : 'unknown'

  const afterCategory = stripped
    .replace(CATEGORY_PREFIX_RE, '')
    .replace(APPERROR_PREFIX_RE, '')

  const friendly = isKnownCategory(category)
    ? FRIENDLY_BY_CATEGORY[category]
    : FRIENDLY_BY_CATEGORY[ErrorCategory.InternalAppError]

  const hint = extractProviderHint(afterCategory)
  const short = hint ? `${friendly} ${hint}` : friendly

  return {
    short,
    detail: stripped,
    category,
  }
}
