var _ = require('lodash')
var errors = require('cc-wallet-core').errors
var createError = errors.createError || require('errno').create


/**
 * Error
 *  +-- ColoredCoinError
 *       +-- AssetNotRecognizedError
 *       +-- MnemonicIsUndefinedError
 *       +-- PaymentError
 *       |    +-- PaymentAlreadyCommitedError
 *       |    +-- PaymentURIError
 *       |    +-- PaymentWasNotProperlyInitializedError
 *       +-- RequestError
 *       +-- SeedError
 *            +-- CannotResetSeedError
 *            +-- SeedIsUndefinedError
 *            +-- WrongSeedError
 */

/**
 * @member {Object} external:cc-wallet-core.errors
 */

/**
 * @member {function} external:cc-wallet-core.errors.ColoredCoinError
 */
var ColoredCoinError = errors.ColoredCoinError


/**
 * @class AssetNotRecognizedError
 * @extends {external:cc-wallet-core.errors.ColoredCoinError}
 */
var AssetNotRecognizedError = createError('AssetNotRecognizedError', ColoredCoinError)

/**
 * @class MnemonicIsUndefinedError
 * @extends {external:cc-wallet-core.errors.ColoredCoinError}
 */
var MnemonicIsUndefinedError = createError('MnemonicIsUndefinedError', ColoredCoinError)

/**
 * @class PaymentError
 * @extends {external:cc-wallet-core.errors.ColoredCoinError}
 */
var PaymentError = createError('PaymentError', ColoredCoinError)

/**
 * @class PaymentAlreadyCommitedError
 * @extends {PaymentError}
 */
var PaymentAlreadyCommitedError = createError('PaymentAlreadyCommitedError', PaymentError)

/**
 * @class PaymentURIError
 * @extends {PaymentError}
 */
var PaymentURIError = createError('PaymentURIError', PaymentError)

/**
 * @class MnemonicIsUndefinedError
 * @extends {PaymentError}
 */
var PaymentWasNotProperlyInitializedError = createError('PaymentWasNotProperlyInitializedError', PaymentError)

/**
 * @class RequestError
 * @extends {external:cc-wallet-core.errors.ColoredCoinError}
 */
var RequestError = createError('RequestError', ColoredCoinError)

/**
 * @class SeedError
 * @extends {external:cc-wallet-core.errors.ColoredCoinError}
 */
var SeedError = createError('SeedError', ColoredCoinError)

/**
 * @class CannotResetSeedError
 * @extends {SeedError}
 */
var CannotResetSeedError = createError('CannotResetSeedError', SeedError)

/**
 * @class SeedIsUndefinedError
 * @extends {SeedError}
 */
var SeedIsUndefinedError = createError('SeedIsUndefinedError', SeedError)

/**
 * @class WrongSeedError
 * @extends {SeedError}
 */
var WrongSeedError = createError('WrongSeedError', SeedError)



module.exports = _.extend(errors, {
  AssetNotRecognizedError: AssetNotRecognizedError,
  MnemonicIsUndefinedError: MnemonicIsUndefinedError,
  PaymentError: PaymentError,
  PaymentAlreadyCommitedError: PaymentAlreadyCommitedError,
  PaymentURIError: PaymentURIError,
  PaymentWasNotProperlyInitializedError: PaymentWasNotProperlyInitializedError,
  RequestError: RequestError,
  SeedError: SeedError,
  CannotResetSeedError: CannotResetSeedError,
  SeedIsUndefinedError: SeedIsUndefinedError,
  WrongSeedError: WrongSeedError
})
