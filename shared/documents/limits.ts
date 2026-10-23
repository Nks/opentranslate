const MEBIBYTE: number = 1024 * 1024

/** Largest source document the main process reads and uploads to a provider. */
export const MAX_DOCUMENT_UPLOAD_BYTES: number = 50 * MEBIBYTE

/** Largest translated document the main process accepts from a provider. */
export const MAX_DOCUMENT_DOWNLOAD_BYTES: number = 100 * MEBIBYTE

/** Minimum time budget for a document upload or download, in milliseconds. */
export const DOCUMENT_REQUEST_TIMEOUT_MS: number = 5 * 60 * 1000
