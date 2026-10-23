export interface CommandOutcome {
  status: number | null
  stderr: string
  error?: Error
}

export type CommandRunner = (command: string, args: readonly string[]) => CommandOutcome

export interface CodeSignatureResult {
  valid: boolean
  detail: string
}

export type CodeSignatureVerifier = (bundlePath: string) => CodeSignatureResult

export const CODESIGN_VERIFY_ARGS: readonly string[] = ['--verify', '--deep', '--strict', '--verbose=2']

function reasonFrom(output: string): string {
  return output
    .split('\n')
    .map((line: string): string => line.trim())
    .filter((line: string): boolean => line.length > 0)
    .join('; ')
}

/**
 * Verifies that a macOS bundle's code signature seals its resources, the
 * property Gatekeeper reports as "damaged" when missing on a quarantined app.
 */
export function verifyCodeSignature(bundlePath: string, run: CommandRunner): CodeSignatureResult {
  const outcome: CommandOutcome = run('codesign', [...CODESIGN_VERIFY_ARGS, bundlePath])

  if (outcome.error !== undefined) {
    return {
      valid: false,
      detail: `codesign unavailable: ${outcome.error.message}`,
    }
  }

  if (outcome.status === 0) {
    return {
      valid: true,
      detail: 'sealed (codesign --verify --deep --strict)',
    }
  }

  const reason: string = reasonFrom(outcome.stderr)

  return {
    valid: false,
    detail: reason.length > 0 ? reason : `codesign exited with status ${String(outcome.status)}`,
  }
}
