import {
  describe, expect, it,
} from 'vitest'
import {
  applySourceChange,
  applyTargetChange,
  type LanguagePair,
} from '@shared/translation/language-pair'

describe('applySourceChange', () => {
  it('sets explicit source without touching target when no conflict', () => {
    const current: LanguagePair = {
      source: {
        mode: 'explicit',
        code: 'en',
      },
      target: 'ru',
    }
    const next = applySourceChange(current, 'de')

    expect(next.source).toEqual({
      mode: 'explicit',
      code: 'de',
    })
    expect(next.target).toBe('ru')
  })

  it('flips source and target when picked source equals current target', () => {
    const current: LanguagePair = {
      source: {
        mode: 'explicit',
        code: 'en',
      },
      target: 'ru',
    }
    const next = applySourceChange(current, 'ru')

    expect(next.source).toEqual({
      mode: 'explicit',
      code: 'ru',
    })
    expect(next.target).toBe('en')
  })

  it('drops the target when source was auto and picked source equals target', () => {
    const current: LanguagePair = {
      source: { mode: 'auto' },
      target: 'ru',
    }
    const next = applySourceChange(current, 'ru')

    expect(next.source).toEqual({
      mode: 'explicit',
      code: 'ru',
    })
    expect(next.target).toBeNull()
  })

  it('switches source to auto when picked is null and leaves target alone', () => {
    const current: LanguagePair = {
      source: {
        mode: 'explicit',
        code: 'en',
      },
      target: 'ru',
    }
    const next = applySourceChange(current, null)

    expect(next.source).toEqual({ mode: 'auto' })
    expect(next.target).toBe('ru')
  })
})

describe('applyTargetChange', () => {
  it('sets target without touching source when no conflict', () => {
    const current: LanguagePair = {
      source: {
        mode: 'explicit',
        code: 'en',
      },
      target: 'ru',
    }
    const next = applyTargetChange(current, 'fr')

    expect(next.target).toBe('fr')
    expect(next.source).toEqual({
      mode: 'explicit',
      code: 'en',
    })
  })

  it('flips source and target when picked target equals current explicit source', () => {
    const current: LanguagePair = {
      source: {
        mode: 'explicit',
        code: 'en',
      },
      target: 'ru',
    }
    const next = applyTargetChange(current, 'en')

    expect(next.target).toBe('en')
    expect(next.source).toEqual({
      mode: 'explicit',
      code: 'ru',
    })
  })

  it('promotes auto source via current target when target collision occurs from auto', () => {
    const current: LanguagePair = {
      source: { mode: 'auto' },
      target: 'ru',
    }
    const next = applyTargetChange(current, 'fr')

    expect(next.source).toEqual({ mode: 'auto' })
    expect(next.target).toBe('fr')
  })

  it('clears the target when picked is null and leaves source alone', () => {
    const current: LanguagePair = {
      source: {
        mode: 'explicit',
        code: 'en',
      },
      target: 'ru',
    }
    const next = applyTargetChange(current, null)

    expect(next.target).toBeNull()
    expect(next.source).toEqual({
      mode: 'explicit',
      code: 'en',
    })
  })

  it('does not produce a same-language pair under any explicit-side change', () => {
    const cases: Array<{
      current: LanguagePair
      picked: string | null
    }> = [
      {
        current: {
          source: {
            mode: 'explicit',
            code: 'en',
          },
          target: 'ru',
        },
        picked: 'en',
      },
      {
        current: {
          source: {
            mode: 'explicit',
            code: 'en',
          },
          target: 'ru',
        },
        picked: 'ru',
      },
      {
        current: {
          source: {
            mode: 'explicit',
            code: 'fr',
          },
          target: 'fr',
        },
        picked: 'de',
      },
    ]

    for (const {
      current, picked,
    } of cases) {
      const afterTarget = applyTargetChange(current, picked)

      if (afterTarget.source.mode === 'explicit' && afterTarget.target !== null) {
        expect(afterTarget.source.code).not.toBe(afterTarget.target)
      }

      const afterSource = applySourceChange(current, picked)

      if (afterSource.source.mode === 'explicit' && afterSource.target !== null) {
        expect(afterSource.source.code).not.toBe(afterSource.target)
      }
    }
  })
})
