var inherits = require('util').inherits
var request = require('request')
var _ = require('lodash')
var Q = require('q')
var bitcore = require('bitcore-lib')
var cclib = require('coloredcoinjs-lib')
var cccore = require('cc-wallet-core')

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
function CWPPPaymentModel (walletEngine, paymentURI) {
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
    uri: cwpp.requestURL(self.paymentURI),
    json: true
  }

  Q.nfcall(request, requestOpts)
    .spread(function (response, body) {
      if (response.statusCode !== 200) {
          throw new errors.RequestError('CWPPPaymentModel: ' + response.statusText)
      }

      var cwppURIHash = cwpp.getURIHash(self.paymentURI)

      if ((cwpp.hashMessage_long(body) !== cwppURIHash) &&
          (cwpp.hashMessage_short(body) !== cwppURIHash)) {
        throw new errors.PaymentError('PaymentRequest hash mismatch')
      }

      self.payreq = body

      if (self.payreq.acceptedMethods.cinputs !== true) {
        throw new errors.PaymentError('incompatible payment method. upgrade required?')
      }

      var assetId = self.payreq.assetId
      self.assetModel = self.walletEngine.getAssetModelById(assetId)
      self.sourceAssetModel = self.assetModel // use the same source
      if (!self.assetModel) {
        throw new errors.AssetNotRecognizedError('CWPPPaymentModel.initialize')
      }

      // TODO this is hackish, move this to AssetDefinition
      var colorAddress = assetId + '@' + self.payreq.address

      self.recipients = [{
        address: colorAddress,
        amount: self.payreq.value && self.assetModel.getAssetDefinition().formatValue(self.payreq.value)
      }]
      self.state = 'fresh'
    })
    .then(function () { cb(null) }, function (err) { cb(err) })
}

/**
 * @throws {NotImplementedError}
 */
CWPPPaymentModel.prototype.addRecipient = function () {
  throw new errors.NotImplementedError('CWPPPaymentModel.addRecipient')
}

CWPPPaymentModel.prototype.setSourceAsset = function (am) {
  this.sourceAssetModel = am
}

function getColorDef (am) {
  var ad = am.getAssetDefinition()
  return ad.getColorSet().getColorDefinitions().then(_.first)
}

/**
 * @callback CWPPPaymentModel~selectCoinsCallback
 * @param {?Error} error
 * @param {cccore.Coin~RawCoin[]} cinputs
 * @param {?{address: string, value: number}} change
 * @param {cclib.definitions.Interface} colordef
 */

/**
 * @param {CWPPPaymentModel~selectCoinsCallback} cb
 */
CWPPPaymentModel.prototype.selectCoins = function (cb) {
  var self = this

  getColorDef(self.sourceAssetModel)
    .then(function (colordef) {
      var neededColorValue = new cclib.ColorValue(colordef, self.payreq.value)
      var opTx = new cccore.tx.OperationalTx(self.walletEngine.getWallet())
      return opTx.selectCoins(neededColorValue, null)
        .then(function (result) {
          var cinputs = _.invoke(result.coins, 'toRawCoin')
          var change = null
          if (result.total.getValue() > self.payreq.value) {
            change = {
              address: opTx.getChangeAddress(colordef),
              value: result.total.getValue() - self.payreq.value
            }
          }

          return [cinputs, change, colordef]
        })
    })
    .then(function (r) { cb(null, r[0], r[1], r[2]) },
          function (err) { cb(err) })
}

/**
 * @param {RawTx} rawTx
 * @param {cccore.Coin~RawCoin[]} cinputs
 * @param {?{address: string, value: number}} change
 * @param {cclib.definitions.Interface} colordef
 * @return {Q.Promise}
 */
CWPPPaymentModel.prototype._checkRawTx = function (rawTx, cinputs, change, colordef) {
  var self = this
  var wallet = self.walletEngine.getWallet()

  return Q.fcall(function () {
    // check inputs
    var tx = rawTx.toTransaction(true)
    var txInputs = _.zipObject(tx.inputs.map(function (input, inputIndex) {
      return [input.prevTxId.toString('hex') + input.outputIndex, inputIndex]
    }))
    var indexes = _.chain(txInputs)
      .keys()
      .difference(cinputs.map(function (input) {
        return input.txId + input.outIndex
      }))
      .map(function (key) { return txInputs[key] })
      .value()

    if (indexes.length === 0) {
      return
    }

    return Q.ninvoke(rawTx, 'getInputAddresses', wallet, indexes)
      .then(function (txAddresses) {
        if (_.intersection(txAddresses, wallet.getAllAddresses()).length > 0) {
          throw new errors.CWPPWrongTxError('Wrong inputs')
        }
      })
  })
  .then(function () {
    // check outputs
    var value = self.payreq.value
    if (self.payreq.fee && self.payreq.fee > 0) {
      value -= self.payreq.fee
    }

    var targets = [{address: self.payreq.address, value: value}]
    if (change !== null) {
      targets.push({address: change.address, value: change.value})
    }

    var colorTargets = targets.map(function (recipient) {
      var address = new bitcore.Address(recipient.address)
      var script = new bitcore.Script(address).toHex()
      var amount = recipient.value
      var colorValue = new cclib.ColorValue(colordef, amount)
      return new cclib.ColorTarget(script, colorValue)
    })

    return Q.ninvoke(rawTx, 'satisfiesTargets', wallet, colorTargets, true)
      .then(function (isSatisfied) {
        if (!isSatisfied) {
          throw new errors.CWPPWrongTxError('Wrong outputs')
        }
      })
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
  function cwppProcess (message) {
    var requestOpts = {
      method: 'POST',
      uri: cwpp.processURL(self.paymentURI),
      body: JSON.stringify(message),
      json: true
    }
    return Q.nfcall(request, requestOpts)
      .spread(function (response, body) {
        if (response.statusCode !== 200) {
          var error = response.statusMessage
          if (_.isObject(body) && body.error !== undefined) {
            error = body.error
          }

          throw new errors.RequestError('CWPPPaymentModel: ' + error)
        }

        return body
      })
  }

  var wallet = self.walletEngine.getWallet()
  var blockchain = wallet.getBlockchain()
  var getTxFn = blockchain.getTx.bind(blockchain)

  console.log('CWPP: selectCoins')
  Q.ninvoke(self, 'selectCoins')
  .spread(function (cinputs, change, in_colordef) {
    // service build transaction
    console.log('CWPP: sending inputs')
    var msg = cwpp.make_cinputs_proc_req_1(in_colordef.getDesc(), cinputs, change)
    return getColorDef(self.assetModel)
      .then(function (out_colordef) {
        return cwppProcess(msg)
          .then(function (response) {
            console.log('CWPP: check tx')
            // restore tx (with prev scripts)
            var tx = new bitcore.Transaction(response.tx_data)
            var ftx = new cclib.tx.FilledInputs(tx, getTxFn)
            return Q.all(tx.inputs.map(function (input, inputIndex) {
              return ftx.getInputTx(inputIndex)
                .then(function (inputTx) {
                  var newInput = bitcore.Transaction()
                    .from({
                      txId: input.prevTxId.toString('hex'),
                      outputIndex: input.outputIndex,
                      script: inputTx.outputs[input.outputIndex].script,
                      satoshis: inputTx.outputs[input.outputIndex].satoshis
                    })
                    .inputs[0]
                  newInput.sequenceNumber = tx.inputs[inputIndex].sequenceNumber
                  tx.inputs[inputIndex] = newInput
                })
            }))
            .then(function () { return tx })
          })
          .then(function (tx) {
            var rawTx = new cccore.tx.RawTx(tx)
            // check inputs and outputs
            return self._checkRawTx(rawTx, cinputs, change, out_colordef)
              .then(function () {
                return rawTx
              })
          })
      })
      .then(function (rawTx) {
        console.log('CWPP: sign tx')
        // we signing transaction
        var tx = rawTx.toTransaction(true)
        var txInputs = _.zipObject(tx.inputs.map(function (input, inputIndex) {
          return [input.prevTxId.toString('hex') + input.outputIndex, inputIndex]
        }))
        var indexes = _.chain(cinputs)
          .map(function (input) {
            return txInputs[input.txId + input.outIndex]
          })
          .value()

        var opts = {seedHex: self.seed, signingOnly: indexes}
        return Q.ninvoke(wallet, 'transformTx', rawTx, 'partially-signed', opts)
      })
  })
  .then(function (tx) {
    console.log('CWPP: sending partially-signed transaction')
    // service signing transaction
    var msg = cwpp.make_cinputs_proc_req_2(tx.toString())
    return cwppProcess(msg)
  })
  .then(function (response) {
    console.log('CWPP: sending fully signed transaction to the network')
    // build transaction and send
    var tx = new bitcore.Transaction(response.tx_data)
    self.txId = tx.id
    return Q.ninvoke(wallet, 'sendTx', tx)
  })
  .then(
    function () {
      self.status = 'send'
      cb(null, self.txId)
    },
    function (err) {
      self.status = 'failed'
      cb(err)
    }
  )
}

module.exports = CWPPPaymentModel
