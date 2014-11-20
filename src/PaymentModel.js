var Q = require('q')


/**
 * @typedef {Object} RecipientObject
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
PaymentModel.prototype.setSeed = function(seed) {
  this.seed = seed
}

/**
 * @return {AssetModel}
 */
PaymentModel.prototype.getAssetModel = function() {
  return this.assetModel
}

/**
 * @return {string}
 */
PaymentModel.prototype.getTotalAmount = function() {
  var assetdef = this.getAssetModel().assetdef

  var amount = this.getRecipients().reduce(function(sum, recipient) {
    return sum + assetdef.parseValue(recipient.amount)
  }, 0)

  return assetdef.formatValue(amount)
}

/**
 * @return {RecipientObject[]}
 */
PaymentModel.prototype.getRecipients = function() {
  return this.recipients
}


/**
 * @param {string} address
 * @return {boolean}
 */
PaymentModel.prototype.checkAddress = function(address) {
  var assetdef = this.assetModel.assetdef
  return this.assetModel.wallet.checkAddress(assetdef, address)
}

/**
 * @param {string} amount
 * @return {boolean}
 */
PaymentModel.prototype.checkAmount = function(amount) {
  var assetdef = this.assetModel.assetdef

  var amountAvailable = assetdef.parseValue(this.assetModel.getAvailableBalance())
  var amountNeeded = assetdef.parseValue(amount)

  return amountAvailable >= amountNeeded
}

/**
 * @param {string} address Color addres or bitcoin address ?
 * @param {string} amount
 * @return {PaymentModel}
 * @throws {Error} If payment already sent
 */
PaymentModel.prototype.addRecipient = function(address, amount) {
  if (this.readOnly)
    throw new Error('payment has already been comitted')

  this.recipients.push({ address: address, amount: amount })

  return this
}

/**
 * @callback PaymentModel~send
 * @param {?Error} error
 */

/**
 * @param {PaymentModel~send} cb
 * @return {PaymentModel}
 * @throws {Error} If payment already sent, recipients list not filled or mnemonic not set
 */
PaymentModel.prototype.send = function(cb) {
  var self = this
  if (self.readOnly)
    throw new Error('Payment has already been comitted')

  if (self.recipients.length === 0)
    throw new Error('Recipients list is empty')

  if (self.seed === null)
    throw new Error('Mnemonic not set')

  var assetdef = self.assetModel.assetdef

  var rawTargets = self.getRecipients().map(function(recipient) {
    return {
      address: self.assetModel.wallet.getBitcoinAddress(assetdef, recipient.address),
      value: assetdef.parseValue(recipient.amount)
    }
  })

  self.readOnly = true
  self.status = 'sending'

  var txId
  var wallet = self.assetModel.wallet
  Q.ninvoke(wallet, 'createTx', self.assetModel.assetdef, rawTargets).then(function(tx) {
    return Q.ninvoke(wallet, 'transformTx', tx, 'signed', self.seed)

  }).then(function(tx) {
    txId = tx.getId()
    return Q.ninvoke(wallet, 'sendTx', tx)

  }).catch(function(error) {
    self.status = 'failed'
    cb(error)

  }).then(function() {
    self.status = 'send'
    cb(null, txId)

  }).finally(function() { self.assetModel.update() }).done()
}

// 'fresh', 'sending', 'sent', 'failed'

/**
 * @return {string}
 */
PaymentModel.prototype.getStatus = function() {
  if (!this.readOnly)
    return 'fresh'

  return this.status
}


module.exports = PaymentModel
