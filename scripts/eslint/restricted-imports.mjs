export const RELATIVE_PARENT_IMPORTS = {
  group: ['../*', '../**/*'],
  message:
    'Use @shared, @electron, or @app path aliases instead of relative parent (../) imports.',
}

const TEST_HELPER_IMPORTS = {
  group: ['@tests', '@tests/*', '@tests/**'],
  message: 'Production code (electron/, app/, shared/) must not import test helpers from @tests/*.',
}

export const productionImportRestrictions = {
  name: 'opentranslate/no-test-helper-imports',
  files: ['electron/**/*.ts', 'shared/**/*.ts', 'app/**/*.{ts,vue}'],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [RELATIVE_PARENT_IMPORTS, TEST_HELPER_IMPORTS],
      },
    ],
  },
}
