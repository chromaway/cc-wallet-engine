var inherits = require('util').inherits

var request = require('request')
var _ = require('lodash')
var Q = require('q')
var cclib = require('cc-wallet-core').cclib
var OperationalTx = require('cc-wallet-core').tx.OperationalTx
var RawTx = require('cc-wallet-core').tx.RawTx

var PaymentModel = require('./PaymentModel')
var cwpp = require('./cwpp')
var errors = require('./errors')


/**
 * @class CWPPPaymentModel
 * @extends PaymentModel
 *
 * @param {WalletEngine} walletEngine
 * @param {string} paymentURI
 */
function CWPPPaymentModel(walletEngine, paymentURI) {
  PaymentModel.call(this)

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

  if (self.readOnly) {
    return cb(new errors.PaymentAlreadyCommitedError())
  }

  if (self.state !== 'fresh') {
    return cb(new errors.PaymentWasNotProperlyInitializedError())
  }

  if (self.recipients.length === 0) {
    return cb(new errors.ZeroArrayLengthError('CWPPPaymentModel.send: recipients list is empty'))
  }

  if (self.seed === null) {
    return cb(new errors.MnemonicIsUndefinedError('CWPPPaymentModel.send'))
  }

  self.readOnly = true
  self.status = 'sending'

  /**
   * @param {Object} message
   * @return {Q.Promise<Object>}
   */
  function cwppProcess(message) {
    // @todo Try add `json: true`
    var requestOpts = {
      method: 'POST',
      uri: cwpp.processURL(self.paymentURI),
      body: JSON.stringify(message)
    }
    return Q.ninvoke(requestOpts).spread(function (response, body) {
      if (response.statusCode !== 200) {
        throw new errors.RequestError('CWPPPaymentModel: ' + response.statusMessage)
      }

      return JSON.parse(body)
    })
  }

  var wallet = self.walletEngine.getWallet()
  var getTxFn = wallet.getBlockchain().getTx.bind(wallet.getBlockchain())
  var bitcoinNetwork = wallet.getBitcoinNetwork()

  Q.ninvoke(self, 'selectCoins').then(function (cinputs, change, colordef) {
    // service build transaction
    var msg = cwpp.make_cinputs_proc_req_1(colordef.getDesc(), cinputs, change)
    return cwppProcess(msg).then(function (response) {
      var rawTx = RawTx.fromHex(response.tx_data)

      return Q.fcall(function () {
        // check inputs
        var tx = rawTx.toTransaction(true)
        var indexes = _.filter(tx.ins.map(function (input, index) {
          var coin = {
            txId: Array.prototype.reverse.call(new Buffer(input.hash)).toString('hex'),
            outIndex: index
          }
          return _.isUndefined(_.find(cinputs, coin)) ? index : undefined
        }))

        if (indexes.length === 0) {
          return
        }

        return Q.ninvoke(tx, 'ensureInputValues', getTxFn).then(function (tx) {
          var matchedCount = _.chain(indexes)
            .map(function (inputIndex) {
              var input = tx.ins[inputIndex]
              var script = input.prevTx.outs[input.index].script
              return cclib.bitcoin.getAddressesFromOutputScript(script, bitcoinNetwork)
            })
            .flatten()
            .intersection(wallet.getAllAddresses())
            .value()
            .length

          if (matchedCount > 0) {
            throw new errors.CWPPWrongTxError('Wrong inputs')
          }
        })

      }).then(function () {
        // check outputs
        var assetdef = self.assetModel.getAssetDefinition()
        var fromBase58Check = cclib.bitcoin.Address.fromBase58Check
        var colorTargets = self.recipients.map(function (recipient) {
          var script = fromBase58Check(recipient.address).toOutputScript().toHex()
          var amount = assetdef.parseValue(recipient.amount)
          var colorValue = new cclib.ColorValue(colordef, amount)
          return new cclib.ColorTarget(script, colorValue)
        })

        return Q.ninvoke(rawTx, 'satisfiesTargets', wallet, colorTargets, false).then(function (isSatisfied) {
          if (!isSatisfied) {
            throw new errors.CWPPWrongTxError('Wrong outputs')
          }
        })

      }).then(function () {
        return rawTx

      })
    })

  }).then(function (rawTx) {
    // we signing transaction
    return Q.ninvoke(wallet, 'transformTx', rawTx, 'partially-signed', self.seed)

  }).then(function (tx) {
    // service signing transaction
    var msg = cwpp.make_cinputs_proc_req_2(tx.toHex(true))
    return cwppProcess(msg)

  }).then(function (response) {
    // build transaction and send
    var tx = RawTx.fromHex(response.tx_data).toTransaction()
    return Q.ninvoke(wallet, 'sendTx', tx)

  }).done(
    function () {
      self.status = 'send'
      cb(null)
    },
    function (error) {
      self.status = 'failed'
      cb(error)
    }
  )
}


module.exports = CWPPPaymentModel
