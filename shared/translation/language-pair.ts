import type {
  SourceLanguageSelection,
} from '@shared/types/translation'

export interface LanguagePair {
  source: SourceLanguageSelection
  target: string | null
}

export function applySourceChange(
  current: LanguagePair,
  picked: string | null,
): LanguagePair {
  if (picked === null) {
    return {
      source: { mode: 'auto' },
      target: current.target,
    }
  }

  const targetConflicts = current.target === picked

  if (!targetConflicts) {
    return {
      source: {
        mode: 'explicit',
        code: picked,
      },
      target: current.target,
    }
  }

  const previousExplicitSource = current.source.mode === 'explicit'
    ? current.source.code
    : null

  return {
    source: {
      mode: 'explicit',
      code: picked,
    },
    target: previousExplicitSource,
  }
}

export function applyTargetChange(
  current: LanguagePair,
  picked: string | null,
): LanguagePair {
  if (picked === null) {
    return {
      source: current.source,
      target: null,
    }
  }

  const sourceConflicts = current.source.mode === 'explicit' &&
    current.source.code === picked

  if (!sourceConflicts) {
    return {
      source: current.source,
      target: picked,
    }
  }

  const promotedSource: SourceLanguageSelection = current.target !== null
    ? {
        mode: 'explicit',
        code: current.target,
      }
    : { mode: 'auto' }

  return {
    source: promotedSource,
    target: picked,
  }
}
