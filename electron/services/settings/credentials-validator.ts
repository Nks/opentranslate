/**
 * Validators for picked credential files.
 *
 * Architecture note: file contents NEVER cross the IPC boundary. The
 * `settings:pick-file` handler returns only the absolute path plus a
 * structured `{ ok, error? }` validation verdict so the renderer can
 * surface inline UX without ever holding the secret material.
 *
 * The forward-looking refactor (backlog B-052) replaces the path with
 * a `safeStorage`-encrypted blob of the parsed credentials. This
 * module is the spot to validate before persisting either shape.
 */

const GOOGLE_SERVICE_ACCOUNT_REQUIRED_KEYS = [
  'client_email',
  'private_key',
  'project_id',
] as const

export interface CredentialsValidation {
  ok: boolean
  error?: string
}

/**
 * Validate the raw text payload of a Google service-account JSON key.
 *
 * Accepts the raw file contents (UTF-8). Returns a structured verdict
 * describing whether the file parses and contains the three required
 * keys (`client_email`, `private_key`, `project_id`).
 */
export function validateGoogleServiceAccountJson(
  rawContents: string,
): CredentialsValidation {
  let parsed: unknown

  try {
    parsed = JSON.parse(rawContents)
  } catch {
    return {
      ok: false,
      error: 'File is not valid JSON.',
    }
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      ok: false,
      error: 'JSON root must be an object.',
    }
  }

  const record = parsed as Record<string, unknown>
  const missing: string[] = []

  for (const key of GOOGLE_SERVICE_ACCOUNT_REQUIRED_KEYS) {
    const value = record[key]

    if (typeof value !== 'string' || value.length === 0) {
      missing.push(key)
    }
  }

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Missing required key${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}.`,
    }
  }

  return {
    ok: true,
  }
}
