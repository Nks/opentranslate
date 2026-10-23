import {
  describe, expect, it,
} from 'vitest'
import {
  documentDropRequestSchema,
  documentTranslateRequestSchema,
} from '@shared/schemas/document-request'

const VALID_REQUEST: Record<string, unknown> = {
  filePath: '/Users/me/report.pdf',
  sourceLanguage: { mode: 'auto' },
  targetLanguage: 'ru',
}

describe('documentTranslateRequestSchema', () => {
  it('accepts an auto-source request', () => {
    expect(documentTranslateRequestSchema.safeParse(VALID_REQUEST).success).toBe(true)
  })

  it('accepts an explicit source with a region subtag', () => {
    const result = documentTranslateRequestSchema.safeParse({
      ...VALID_REQUEST,
      sourceLanguage: {
        mode: 'explicit',
        code: 'zh-Hans',
      },
      targetLanguage: 'pt-BR',
    })

    expect(result.success).toBe(true)
  })

  it.each(['', '../ru', 'ru/..', 'r u', 'ru.translated', 'x'.repeat(40)])(
    'rejects target language %j that could escape the output filename',
    (targetLanguage: string) => {
      const result = documentTranslateRequestSchema.safeParse({
        ...VALID_REQUEST,
        targetLanguage,
      })

      expect(result.success).toBe(false)
    },
  )

  it('rejects an explicit source code with path characters', () => {
    const result = documentTranslateRequestSchema.safeParse({
      ...VALID_REQUEST,
      sourceLanguage: {
        mode: 'explicit',
        code: '../en',
      },
    })

    expect(result.success).toBe(false)
  })

  it('rejects an empty file path', () => {
    expect(documentTranslateRequestSchema.safeParse({
      ...VALID_REQUEST,
      filePath: '',
    }).success).toBe(false)
  })

  it('rejects a file path containing a NUL byte', () => {
    expect(documentTranslateRequestSchema.safeParse({
      ...VALID_REQUEST,
      filePath: '/tmp/a\u0000.pdf',
    }).success).toBe(false)
  })

  it('rejects unknown keys', () => {
    expect(documentTranslateRequestSchema.safeParse({
      ...VALID_REQUEST,
      outputPath: '/etc/passwd',
    }).success).toBe(false)
  })

  it('rejects non-object payloads', () => {
    expect(documentTranslateRequestSchema.safeParse(null).success).toBe(false)
    expect(documentTranslateRequestSchema.safeParse('/tmp/a.pdf').success).toBe(false)
  })
})

describe('documentDropRequestSchema', () => {
  it('accepts a single file path', () => {
    expect(documentDropRequestSchema.safeParse({ filePath: '/docs/a.txt' }).success).toBe(true)
  })

  it.each([
    {},
    { filePath: '' },
    { filePath: '/tmp/a\u0000.txt' },
    {
      filePath: '/docs/a.txt',
      extra: true,
    },
    null,
  ])('rejects %j', (payload: unknown) => {
    expect(documentDropRequestSchema.safeParse(payload).success).toBe(false)
  })
})
