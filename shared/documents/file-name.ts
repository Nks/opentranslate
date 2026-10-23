import {
  normalizeDocumentExtension,
} from '@shared/documents/formats'

const PATH_SEPARATOR_RE: RegExp = /[\\/]+/

/**
 * Last path segment of a POSIX or Windows path. Pure string logic, so it is
 * safe in the renderer where `node:path` is unavailable.
 */
export function documentBaseName(path: string): string {
  const segments: string[] = path.split(PATH_SEPARATOR_RE).filter(
    (segment: string): boolean => segment.length > 0,
  )

  return segments.at(-1) ?? ''
}

/**
 * Normalized `.ext` of a file name, or `''` when it has none. Dotfiles such
 * as `.bashrc` have no extension, matching `node:path` `extname`.
 */
export function documentExtension(fileName: string): string {
  const dotIndex: number = fileName.lastIndexOf('.')

  if (dotIndex <= 0) {
    return ''
  }

  return normalizeDocumentExtension(fileName.slice(dotIndex)) ?? ''
}
