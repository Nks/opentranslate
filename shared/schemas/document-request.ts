import {
  z,
} from 'zod'

const LANGUAGE_CODE_RE: RegExp = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8}){0,3}$/
const MAX_LANGUAGE_CODE_LENGTH: number = 35
const MAX_FILE_PATH_LENGTH: number = 4096

export const documentLanguageCodeSchema = z
  .string()
  .max(MAX_LANGUAGE_CODE_LENGTH)
  .regex(LANGUAGE_CODE_RE)

const documentSourceLanguageSchema = z.discriminatedUnion('mode', [
  z.strictObject({
    mode: z.literal('auto'),
  }),
  z.strictObject({
    mode: z.literal('explicit'),
    code: documentLanguageCodeSchema,
  }),
])

export const documentFilePathSchema = z
  .string()
  .min(1)
  .max(MAX_FILE_PATH_LENGTH)
  .refine((value: string): boolean => !value.includes('\u0000'), {
    message: 'filePath must not contain NUL bytes',
  })

export const documentTranslateRequestSchema = z.strictObject({
  filePath: documentFilePathSchema,
  sourceLanguage: documentSourceLanguageSchema,
  targetLanguage: documentLanguageCodeSchema,
})

export const documentDropRequestSchema = z.strictObject({
  filePath: documentFilePathSchema,
})

export type DocumentTranslateRequest = z.infer<typeof documentTranslateRequestSchema>
export type DocumentDropRequest = z.infer<typeof documentDropRequestSchema>
