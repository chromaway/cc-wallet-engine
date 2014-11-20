var PaymentModel = require('./PaymentModel')
var inherits = require('util').inherits
var request = require('request')
var cwpp = require('./cwpp')
var cclib = require('cc-wallet-core').cclib
var OperationalTx = require('cc-wallet-core').tx.OperationalTx
var RawTx = require('cc-wallet-core').tx.RawTx

/**
 * @class CWPPPaymentModel
 * @extends PaymentModel
 *
 * @param {cc-wallet-core.Wallet} walletEngine
 * @param {string} paymentURI
 */
function CWPPPaymentModel(walletEngine, paymentURI) {
  PaymentModel(null, null)

  this.walletEngine = walletEngine
  this.paymentURI = paymentURI
  this.state = 'non-initialized'
  this.payreq = null
}

inherits(CWPPPaymentModel, PaymentModel)

/**
 * @callback CWPPPaymentModel~initialize
 * @param {?Error} error
 */

/**
 * @param {CWPPPaymentModel~initialize} cb
 * @throws {Error}
 */
CWPPPaymentModel.prototype.initialize = function (cb) {
  var self = this

  var requestOpts = {
    method: 'GET',
    uri: cwpp.requestURL(self.paymentURI)
  }

  request(requestOpts, function(error, response, body) {
    if (error)
      return cb(error)

    if (response.statusCode !== 200)
      return cb(new Error('request failed'))

    self.payreq = JSON.parse(body)

    var assetId = self.payreq.assetId
    self.assetModel = self.walletEngine.assetModels.models[assetId]
    if (!self.assetModel)
      return cb(new Error('asset not found'))

    self.recipients = [{
      address: self.payreq.address,
      amount: self.assetModel.assetdef.formatValue(self.payreq.value)
    }]
    self.state = 'fresh'

    cb(null)
  })
}

/**
 * @param {string} address
 * @param {string} amount
 * @throws {Error}
 */
CWPPPaymentModel.prototype.addRecipient = function() {
  throw Error('can only get recipients from payment URI')
}

/**
 * @callback CWPPPaymentModel~selectCoins
 * @param {?Error} error
 * @param {cc-wallet-core.coin.RawCoin[]} cinputs
 * @param {?{address: string, value: number}} change
 * @param {coloredcoinjs-lib.ColorDefinition} colordef
 */

/**
 * @param {CWPPPaymentModel~selectCoins} cb
 */
CWPPPaymentModel.prototype.selectCoins = function(cb) {
  var self = this

  var assetdef = self.assetModel.assetdef
  var colordef = assetdef.getColorSet().getColorDefinitions()[0]
  var neededColorValue = new cclib.ColorValue(colordef, self.payreq.value)

  var opTx = new OperationalTx(self.walletEngine.ccWallet)
  opTx.selectCoins(neededColorValue, null, function(error, coins, colorValue) {
    if (error)
      return cb(error)

    var cinputs = coins.map(function (coin) { return coin.toRawCoin() })
    var change = null
    if (colorValue.getValue() > self.payreq.value)
      change = {
        address: opTx.getChangeAddress(colordef),
        value: colorValue.getValue() - self.payreq.value
      }

    cb(null, cinputs, change, colordef)
  })
}


/**
 * @callback CWPPPaymentModel~send
 * @param {?Error} error
 * @param {string} txId
 */

/**
 * @param {CWPPPaymentModel~send} cb
 */
CWPPPaymentModel.prototype.send = function(cb) {
  var self = this

  if (this.readOnly)
    return cb(new Error('Payment has already been comitted'))

  if (this.state !== 'fresh')
    return cb(new Error('Payment was not properly initialized'))

  if (this.recipients.length === 0)
    return cb(new Error('Recipients list is empty'))

  if (this.seed === null)
    return cb(new Error('Mnemonic not set'))

  this.readOnly = true
  this.status = 'sending'

  function fail(error) {
    self.status = 'failed'
    cb(error)
  }

  var processURL= cwpp.processURL(this.paymentURI)
  function cwppProcess(message, prcb) {
    var requestOpts = {
      method: 'POST',
      uri: processURL,
      body: JSON.stringify(message)
    }
    request(requestOpts, function(error, response, body) {
      if (error)
        return fail(error)

      if (response.statusCode !== 200)
        return fail(new Error('request failed'))

      prcb(JSON.parse(body))
    })
  }

  var wallet = this.walletEngine.ccWallet;
  this.selectCoins(function(error, cinputs, change, colordef) {
    if (error)
      return fail(error)

    var msg = cwpp.make_cinputs_proc_req_1(colordef.getDesc(), cinputs, change)
    cwppProcess(msg, function(resp) {
      var rawTx = RawTx.fromHex(resp.tx_data)
      // TODO: check before signing tx!
      wallet.transformTx(rawTx, 'partially-signed', self.seed, function(error, tx) {
        if (error)
          return fail(error)

        msg = cwpp.make_cinputs_proc_req_2(tx.toHex(true))
        cwppProcess(msg, function(resp) {
            var rawTx = RawTx.fromHex(resp.tx_data);
            wallet.sendTx(rawTx.toTransaction(), cb);
        })
      })
    })
  })
}


module.exports = CWPPPaymentModel
