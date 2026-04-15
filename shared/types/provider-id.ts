export const PROVIDER_IDS = ['google', 'libretranslate'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];
