var _ = require('lodash')
var request = require('request')
var Q = require('q')
var verify = require('cc-wallet-core').verify

var errors = require('./errors')
var cwpp = require('./cwpp')
var stringify = require('json-stable-stringify')



/**
 * @class PaymentRequestModel
 * @param {external:cc-wallet-core.Wallet} wallet
 * @param {external:cc-wallet-core.AssetDefinition} assetdef
 * @param {Object} props
 * @param {number} props.amount
 * @param {string} [props.address]
 * @param {string} [props.cwpp_host]
 */
function PaymentRequestModel(wallet, assetdef, props) {
  verify.Wallet(wallet)
  verify.AssetDefinition(assetdef)
  verify.object(props)
  // props.amount verified in assetdef.parseValue
  if (!_.isUndefined(props.address)) { verify.string(props.address) }
  if (!_.isUndefined(props.cwpp_host)) { verify.string(props.cwpp_host) }

  this.paymentURI = null

  this.wallet = wallet
  this.assetdef = assetdef
  this.props = props

  if (_.isUndefined(props.address)) {
    props.address = wallet.getSomeAddress(assetdef, false)
  } else {
    // need uncolored address
    props.address = wallet.getBitcoinAddress(props.address)
  }

  if (_.isUndefined(props.cwpp_host)) {
    var networkName = this.wallet.getNetworkName()
    props.cwpp_host = networkName + '.cwpp.chromapass.net'
  }

  var value = assetdef.parseValue(props.amount)
  this.cwppPayReq = cwpp.make_cinputs_payment_request(
    value, props.address, assetdef.getId(), assetdef.getColorSet().colorDescs[0])
}

/**
 * @callback PaymentRequestModel~getPaymentURICallback
 * @param {?Error} error
 * @param {string} uri
 */

/**
 * @param {PaymentRequestModel~getPaymentURICallback} cb
 */
PaymentRequestModel.prototype.getPaymentURI = function (cb) {
  verify.function(cb)

  var self = this
  if (self.paymentURI === null) {
    var requestOpts = {
      method: 'POST',
      uri: 'http://' + self.props.cwpp_host + '/cwpp/new-request',
      body: stringify(self.cwppPayReq),
      json: true
    }

    self.paymentURI = Q.nfcall(request, requestOpts).spread(function (response, body) {
      if (response.statusCode !== 200) {
        throw new errors.RequestError('PaymentRequestModel: ' + response.statusMessage)
      }
      if (body.hash !== cwpp.hashMessage(self.cwppPayReq)) {
        throw new errors.RequestError('PaymentRequest hash doesn\'t match')
      }

      return cwpp.make_cwpp_uri(self.props.cwpp_host, body.hash)
    })
  }

  self.paymentURI.done(
    function (uri) { cb(null, uri) },
    function (error) { cb(error) }
  )
}

module.exports = PaymentRequestModel
