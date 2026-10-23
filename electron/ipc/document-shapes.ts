import type {
  SourceLanguageSelection,
} from '@shared/types/translation'

/** A file main validated and allowlisted, with the name and extension it resolved. */
export interface DocumentPickResponseShape {
  filePath: string
  fileName: string
  extension: string
}

/**
 * Sent only by the preload bridge, which resolves the path of a dropped
 * `File` with `webUtils.getPathForFile`. The renderer never supplies it;
 * main validates the file before allowlisting it for `document:translate`.
 */
export interface DocumentDropRequestShape {
  filePath: string
}

export interface DocumentTranslateRequestShape {
  filePath: string
  sourceLanguage: SourceLanguageSelection
  targetLanguage: string
}

export interface DocumentTranslateResponseShape {
  outputPath: string
  provider: string
}

export interface DocumentStatusResponseShape {
  supported: boolean
  formats?: string[]
  message?: string
}
