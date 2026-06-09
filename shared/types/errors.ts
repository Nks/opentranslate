export const ErrorCategory = {
  NetworkUnavailable: 'network_unavailable',
  EndpointUnreachable: 'endpoint_unreachable',
  TlsError: 'tls_error',
  AuthenticationFailure: 'authentication_failure',
  UnsupportedLanguage: 'unsupported_language',
  UnsupportedDocumentType: 'unsupported_document_type',
  QuotaExceeded: 'quota_exceeded',
  RateLimited: 'rate_limited',
  InvalidProviderResponse: 'invalid_provider_response',
  InternalAppError: 'internal_app_error',
} as const

export type ErrorCategoryId = (typeof ErrorCategory)[keyof typeof ErrorCategory]
