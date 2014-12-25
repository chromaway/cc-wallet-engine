var PaymentModel = require('./PaymentModel')
var inherits = require('util').inherits
var request = require('request')
var cwpp = require('./cwpp')
var cclib = require('cc-wallet-core').cclib
var errors = require('./errors')
var OperationalTx = require('cc-wallet-core').tx.OperationalTx
var RawTx = require('cc-wallet-core').tx.RawTx


/**
 * @class CWPPPaymentModel
 * @extends PaymentModel
 *
 * @param {WalletEngine} walletEngine
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
 * @callback CWPPPaymentModel~initializeCallback
 * @param {?Error} error
 */

/**
 * @param {CWPPPaymentModel~initializeCallback} cb
 * @throws {Error}
 */
CWPPPaymentModel.prototype.initialize = function (cb) {
  var self = this

  var requestOpts = {
    method: 'GET',
    uri: cwpp.requestURL(self.paymentURI)
    //json: true ?
  }

  request(requestOpts, function (error, response, body) {
    if (error) {
      return cb(error)
    }

    if (response.statusCode !== 200) {
      return cb(new errors.RequestError('CWPPPaymentModel: ' + response.statusMessage))
    }

    self.payreq = JSON.parse(body)

    var assetId = self.payreq.assetId
    self.assetModel = self.walletEngine.getAssetModelById(assetId)
    if (!self.assetModel) {
      return cb(new errors.AssetNotRecognizedError('CWPPPaymentModel.initialize'))
    }

    self.recipients = [{
      address: self.payreq.address,
      amount: self.assetModel.getAssetDefinition().formatValue(self.payreq.value)
    }]
    self.state = 'fresh'

    cb(null)
  })
}

/**
 * @throws {NotImplementedError}
 */
CWPPPaymentModel.prototype.addRecipient = function () {
  throw new errors.NotImplementedError('CWPPPaymentModel.addRecipient')
}

/**
 * @callback CWPPPaymentModel~selectCoinsCallback
 * @param {?Error} error
 * @param {external:cc-wallet-core.Coin~RawCoin[]} cinputs
 * @param {?{address: string, value: number}} change
 * @param {external:cc-wallet-core.cclib.ColorDefinition} colordef
 */

/**
 * @param {CWPPPaymentModel~selectCoinsCallback} cb
 */
CWPPPaymentModel.prototype.selectCoins = function (cb) {
  var self = this

  var assetdef = self.assetModel.getAssetDefinition()
  var colordef = assetdef.getColorSet().getColorDefinitions()[0]
  var neededColorValue = new cclib.ColorValue(colordef, self.payreq.value)

  var opTx = new OperationalTx(self.walletEngine.getWallet())
  opTx.selectCoins(neededColorValue, null, function (error, coins, colorValue) {
    if (error) {
      return cb(error)
    }

    var cinputs = coins.map(function (coin) { return coin.toRawCoin() })
    var change = null
    if (colorValue.getValue() > self.payreq.value) {
      change = {
        address: opTx.getChangeAddress(colordef),
        value: colorValue.getValue() - self.payreq.value
      }
    }

    cb(null, cinputs, change, colordef)
  })
}


/**
 * @callback CWPPPaymentModel~sendCallback
 * @param {?Error} error
 */

/**
 * @param {CWPPPaymentModel~sendCallback} cb
 */
CWPPPaymentModel.prototype.send = function (cb) {
  var self = this

  if (this.readOnly) {
    return cb(new errors.PaymentAlreadyCommitedError())
  }

  if (this.state !== 'fresh') {
    return cb(new errors.PaymentWasNotProperlyInitializedError())
  }

  if (this.recipients.length === 0) {
    return cb(new errors.ZeroArrayLengthError('CWPPPaymentModel.send: recipients list is empty'))
  }

  if (this.seed === null) {
    return cb(new errors.MnemonicIsUndefinedError('CWPPPaymentModel.send'))
  }

  this.readOnly = true
  this.status = 'sending'

  function fail(error) {
    self.status = 'failed'
    cb(error)
  }

  var processURL = cwpp.processURL(this.paymentURI)
  function cwppProcess(message, prcb) {
    var requestOpts = {
      method: 'POST',
      uri: processURL,
      body: JSON.stringify(message)
    }
    request(requestOpts, function (error, response, body) {
      if (error) { return fail(error) }

      if (response.statusCode !== 200) {
        return fail(new errors.RequestError('CWPPPaymentModel: ' + response.statusMessage))
      }

      prcb(JSON.parse(body))
    })
  }

  var wallet = this.walletEngine.getWallet()
  this.selectCoins(function (error, cinputs, change, colordef) {
    if (error) { return fail(error) }

    var msg = cwpp.make_cinputs_proc_req_1(colordef.getDesc(), cinputs, change)
    cwppProcess(msg, function (resp) {
      var rawTx = RawTx.fromHex(resp.tx_data)
      // @todo Check before signing tx!
      wallet.transformTx(rawTx, 'partially-signed', self.seed, function (error, tx) {
        if (error) { return fail(error) }

        msg = cwpp.make_cinputs_proc_req_2(tx.toHex(true))
        cwppProcess(msg, function (resp) {
          var rawTx = RawTx.fromHex(resp.tx_data);
          wallet.sendTx(rawTx.toTransaction(), cb);
        })
      })
    })
  })
}


module.exports = CWPPPaymentModel
