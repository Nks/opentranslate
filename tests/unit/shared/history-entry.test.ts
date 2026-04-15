import { describe, expect, it } from 'vitest'
import { historyEntrySchema } from '@shared/schemas/history-entry'

const validEntry = {
  id: '01HF000000000000000000000A',
  sourceText: 'hello',
  translatedText: 'hola',
  sourceLanguageCode: 'en',
  targetLanguageCode: 'es',
  provider: 'google' as const,
  createdAt: '2026-04-15T16:48:00.000Z',
}

describe('historyEntrySchema', () => {
  it('accepts a valid entry', () => {
    expect(historyEntrySchema.safeParse(validEntry).success).toBe(true)
  })

  it('rejects empty sourceText', () => {
    expect(historyEntrySchema.safeParse({ ...validEntry, sourceText: '' }).success).toBe(false)
  })

  it('rejects unknown provider', () => {
    expect(historyEntrySchema.safeParse({ ...validEntry, provider: 'deepl' }).success).toBe(false)
  })

  it('rejects non-ISO createdAt', () => {
    expect(historyEntrySchema.safeParse({ ...validEntry, createdAt: 'yesterday' }).success).toBe(
      false,
    )
  })
})
