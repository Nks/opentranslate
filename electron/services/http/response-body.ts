import {
  AppError, ErrorCategory,
} from '@shared/errors'
import {
  readBoundedBody, type BoundedBody,
} from '@electron/services/http/bounded-body'

export const MAX_ERROR_BODY_BYTES: number = 64 * 1024
export const MAX_JSON_BODY_BYTES: number = 1024 * 1024

const utf8: TextDecoder = new TextDecoder()

function parseJsonOrText(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export async function readErrorBody(response: Response): Promise<unknown> {
  let body: BoundedBody

  try {
    body = await readBoundedBody(response.body, MAX_ERROR_BODY_BYTES)
  } catch {
    return null
  }

  return body.kind === 'complete' ? parseJsonOrText(utf8.decode(body.bytes)) : null
}

export async function readJsonBody<T>(response: Response, providerId: string): Promise<T> {
  let body: BoundedBody

  try {
    body = await readBoundedBody(response.body, MAX_JSON_BODY_BYTES)
  } catch (err: unknown) {
    throw new AppError(
      ErrorCategory.EndpointUnreachable,
      `${providerId}: response interrupted — ${String((err as Error).message ?? err)}`,
      err,
    )
  }

  if (body.kind === 'too-large') {
    throw new AppError(
      ErrorCategory.InvalidProviderResponse,
      `${providerId}: response body exceeds ${MAX_JSON_BODY_BYTES} bytes`,
    )
  }

  try {
    return JSON.parse(utf8.decode(body.bytes)) as T
  } catch (err: unknown) {
    throw new AppError(
      ErrorCategory.InvalidProviderResponse,
      `${providerId}: response body is not valid JSON`,
      err,
    )
  }
}
