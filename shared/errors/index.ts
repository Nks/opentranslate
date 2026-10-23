export {
  ErrorCategory, type ErrorCategoryId,
} from '@shared/types/errors'
export {
  AppError, toErrorCategory,
} from './mapper'
export {
  mapHttpStatusToCategory, truncateProviderDetail,
} from './http-mapper'
