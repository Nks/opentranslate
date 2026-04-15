import { z } from 'zod';
import { PROVIDER_IDS } from '../types/provider-id.js';

const providerIdSchema = z.enum(PROVIDER_IDS);

export const historyEntrySchema = z.object({
  id: z.string().min(1),
  sourceText: z.string().min(1),
  translatedText: z.string(),
  sourceLanguageCode: z.string().min(1),
  targetLanguageCode: z.string().min(1),
  provider: providerIdSchema,
  createdAt: z.string().datetime({ offset: true }),
});
