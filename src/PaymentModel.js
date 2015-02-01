var Q = require('q')

var errors = require('./errors')


/**
 * @typedef {Object} PaymentModel~RecipientObject
 * @property {string} address
 * @property {string} amount
 */

/**
 * @class PaymentModel
 * @param {AssetModel} assetModel
 */
function PaymentModel(assetModel, seed) {
  this.assetModel = assetModel
  this.readOnly = false
  this.status = null
  this.recipients = []
  this.seed = seed
}

/**
 * @param {string} seed
 */
PaymentModel.prototype.setSeed = function (seed) {
  this.seed = seed
}

/**
 * @return {AssetModel}
 */
PaymentModel.prototype.getAssetModel = function () {
  return this.assetModel
}

/**
 * @return {string}
 */
PaymentModel.prototype.getTotalAmount = function () {
  var assetdef = this.getAssetModel().getAssetDefinition()

  var amount = this.getRecipients().reduce(function (sum, recipient) {
    return sum + assetdef.parseValue(recipient.amount)
  }, 0)

  return assetdef.formatValue(amount)
}

/**
 * @return {PaymentModel~RecipientObject[]}
 */
PaymentModel.prototype.getRecipients = function () {
  return this.recipients
}


/**
 * @param {string} address
 * @return {boolean}
 */
PaymentModel.prototype.checkAddress = function (address) {
  var assetdef = this.assetModel.getAssetDefinition()
  return this.assetModel.getWallet().checkAddress(assetdef, address)
}

/**
 * @param {string} amount
 * @return {boolean}
 */
PaymentModel.prototype.checkAmount = function (amount) {
  var assetdef = this.assetModel.getAssetDefinition()

  var amountAvailable = assetdef.parseValue(this.assetModel.getAvailableBalance())
  var amountNeeded = assetdef.parseValue(amount)

  return amountAvailable >= amountNeeded
}

/**
 * @param {string} address Color addres or bitcoin address ?
 * @param {string} amount
 * @return {PaymentModel}
 * @throws {PaymentAlreadyCommitedError}
 */
PaymentModel.prototype.addRecipient = function (address, amount) {
  if (this.readOnly) {
    throw new errors.PaymentAlreadyCommitedError()
  }

  this.recipients.push({address: address, amount: amount})

  return this
}

/**
 * @callback PaymentModel~sendCallback
 * @param {?Error} error
 */

/**
 * @param {PaymentModel~sendCallback} cb
 */
PaymentModel.prototype.send = function (cb) {
  var self = this

  if (self.readOnly) {
    return cb(new errors.PaymentAlreadyCommitedError())
  }

  if (self.recipients.length === 0) {
    return cb(new errors.ZeroArrayLengthError('PaymentModel.send: recipients list is empty'))
  }

  if (self.seed === null) {
    return cb(new errors.MnemonicIsUndefinedError('PaymentModel.send'))
  }

  var assetdef = self.assetModel.getAssetDefinition()

  var rawTargets = self.getRecipients().map(function (recipient) {
    return {
      address: self.assetModel.getWallet().getBitcoinAddress(recipient.address),
      value: assetdef.parseValue(recipient.amount)
    }
  })

  self.readOnly = true
  self.status = 'sending'

  var wallet = self.assetModel.getWallet()
  Q.ninvoke(wallet, 'createTx', self.assetModel.getAssetDefinition(), rawTargets).then(function (tx) {
    return Q.ninvoke(wallet, 'transformTx', tx, 'signed', {seedHex: self.seed})

  }).then(function (tx) {
    return Q.ninvoke(wallet, 'sendTx', tx)

  }).done(function () {
    self.status = 'send'
    cb(null)

  }, function (error) {
    self.status = 'failed'
    cb(error)

  })
}

// 'fresh', 'sending', 'sent', 'failed'

/**
 * @return {string}
 */
PaymentModel.prototype.getStatus = function () {
  if (!this.readOnly) { return 'fresh' }

  return this.status
}


module.exports = PaymentModel
