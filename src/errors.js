var _ = require('lodash')
var errors = require('cc-wallet-core').errors
var createError = errors.createError || require('errno').create

/**
 * Error
 *  +-- ColoredCoinError
 *       +-- AssetNotRecognizedError
 *       +-- MnemonicIsUndefinedError
 *       +-- PaymentError
 *       |    +-- CWPPWrongTxError
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
 * @member {Object} cccore.errors
 */

/**
 * @member {function} cccore.errors.ColoredCoin
 */
var ColoredCoinError = errors.ColoredCoin

/**
 * @class AssetNotRecognizedError
 * @extends {cccore.errors.ColoredCoin}
 */
var AssetNotRecognizedError = createError('AssetNotRecognizedError', ColoredCoinError)

/**
 * @class MnemonicIsUndefinedError
 * @extends {cccore.errors.ColoredCoin}
 */
var MnemonicIsUndefinedError = createError('MnemonicIsUndefinedError', ColoredCoinError)

/**
 * @class PaymentError
 * @extends {cccore.errors.ColoredCoin}
 */
var PaymentError = createError('PaymentError', ColoredCoinError)

/**
 * @class CWPPWrongTxError
 * @extends {PaymentError}
 */
var CWPPWrongTxError = createError('CWPPWrongTxError', PaymentError)

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
 * @extends {cccore.errors.ColoredCoinError}
 */
var RequestError = createError('RequestError', ColoredCoinError)

/**
 * @class SeedError
 * @extends {cccore.errors.ColoredCoinError}
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
  CWPPWrongTxError: CWPPWrongTxError,
  PaymentAlreadyCommitedError: PaymentAlreadyCommitedError,
  PaymentURIError: PaymentURIError,
  PaymentWasNotProperlyInitializedError: PaymentWasNotProperlyInitializedError,
  RequestError: RequestError,
  SeedError: SeedError,
  CannotResetSeedError: CannotResetSeedError,
  SeedIsUndefinedError: SeedIsUndefinedError,
  WrongSeedError: WrongSeedError
})
