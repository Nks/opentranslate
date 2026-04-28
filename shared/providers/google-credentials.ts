export interface GoogleCredentialsValidationOk {
  valid: true
  projectId: string
  clientEmail: string
}

export interface GoogleCredentialsValidationError {
  valid: false
  error: string
}

export type GoogleCredentialsValidation =
  | GoogleCredentialsValidationOk
  | GoogleCredentialsValidationError

const REQUIRED_FIELDS: ReadonlyArray<'project_id' | 'client_email' | 'private_key'> = [
  'project_id',
  'client_email',
  'private_key',
]

export function validateGoogleCredentialsJson(text: string): GoogleCredentialsValidation {
  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch (err: unknown) {
    const reason = err instanceof Error ? err.message : String(err)

    return {
      valid: false,
      error: `Not a JSON file: ${reason}`,
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return {
      valid: false,
      error: 'JSON must be a Google service-account object.',
    }
  }

  const record = parsed as Record<string, unknown>
  const missing: string[] = REQUIRED_FIELDS.filter((field): boolean => {
    const value = record[field]

    return typeof value !== 'string' || value.length === 0
  })

  if (missing.length > 0) {
    return {
      valid: false,
      error: `Service-account JSON is missing required field(s): ${missing.join(', ')}.`,
    }
  }

  return {
    valid: true,
    projectId: record.project_id as string,
    clientEmail: record.client_email as string,
  }
}
