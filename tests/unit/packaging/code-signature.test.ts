import {
  describe, expect, it,
} from 'vitest'
import {
  CODESIGN_VERIFY_ARGS,
  verifyCodeSignature,
  type CodeSignatureResult,
  type CommandOutcome,
  type CommandRunner,
} from '@scripts/packaging/code-signature'

const BUNDLE: string = '/release/mac-arm64/OpenTranslate Desktop.app'

interface RecordedRun {
  command: string
  args: readonly string[]
}

function runnerReturning(outcome: CommandOutcome, calls: RecordedRun[] = []): CommandRunner {
  return (command: string, args: readonly string[]): CommandOutcome => {
    calls.push({
      command,
      args,
    })

    return outcome
  }
}

describe('verifyCodeSignature', () => {
  it('runs codesign --verify --deep --strict on the bundle', () => {
    const calls: RecordedRun[] = []

    verifyCodeSignature(BUNDLE, runnerReturning({
      status: 0,
      stderr: '',
    }, calls))

    expect(CODESIGN_VERIFY_ARGS).toEqual(['--verify', '--deep', '--strict', '--verbose=2'])
    expect(calls).toEqual([{
      command: 'codesign',
      args: [...CODESIGN_VERIFY_ARGS, BUNDLE],
    }])
  })

  it('accepts a bundle whose seal verifies', () => {
    const result: CodeSignatureResult = verifyCodeSignature(BUNDLE, runnerReturning({
      status: 0,
      stderr: `${BUNDLE}: valid on disk\n${BUNDLE}: satisfies its Designated Requirement\n`,
    }))

    expect(result).toEqual({
      valid: true,
      detail: 'sealed (codesign --verify --deep --strict)',
    })
  })

  it('rejects an unsealed bundle with codesign\'s reason', () => {
    const result: CodeSignatureResult = verifyCodeSignature(BUNDLE, runnerReturning({
      status: 1,
      stderr: `${BUNDLE}: code has no resources but signature indicates they must be present\n`,
    }))

    expect(result).toEqual({
      valid: false,
      detail: `${BUNDLE}: code has no resources but signature indicates they must be present`,
    })
  })

  it('keeps every line of a multi-line codesign reason', () => {
    const result: CodeSignatureResult = verifyCodeSignature(BUNDLE, runnerReturning({
      status: 1,
      stderr: `${BUNDLE}: code object is not signed at all\nIn architecture: x86_64\n`,
    }))

    expect(result.detail).toBe(`${BUNDLE}: code object is not signed at all; In architecture: x86_64`)
  })

  it('rejects when codesign cannot run, e.g. off macOS', () => {
    const result: CodeSignatureResult = verifyCodeSignature(BUNDLE, runnerReturning({
      status: null,
      stderr: '',
      error: new Error('spawnSync codesign ENOENT'),
    }))

    expect(result).toEqual({
      valid: false,
      detail: 'codesign unavailable: spawnSync codesign ENOENT',
    })
  })

  it('rejects a failure without stderr by exit status', () => {
    const result: CodeSignatureResult = verifyCodeSignature(BUNDLE, runnerReturning({
      status: 3,
      stderr: '  \n',
    }))

    expect(result).toEqual({
      valid: false,
      detail: 'codesign exited with status 3',
    })
  })
})
