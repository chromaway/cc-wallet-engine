var assert = require('assert')

var _ = require('lodash')
var request = require('request')

var cwpp = require('./cwpp')


/**
 * @class PaymentRequestModel
 * @param {ccWallet} wallet
 * @param {AssetDefinition} assetdef
 * @param {Object} props
 */
function PaymentRequestModel(wallet, assetdef, props) {
  assert(props.amount, 'Amount must be provided')

  this.paymentURI = null

  this.wallet = wallet
  this.assetdef = assetdef
  this.props = props

  if (_.isUndefined(props.address)) {
    props.address = wallet.getSomeAddress(assetdef, false)
  } else {
    // need uncolored address
    props.address = wallet.getBitcoinAddress(assetdef, props.address)
  }

  if (_.isUndefined(props.cwpp_host)) {
    props.cwpp_host = 'cwpp.chromapass.net'
  }

  var value = assetdef.parseValue(props.amount)
  this.cwppPayReq = cwpp.make_cinputs_payment_request(
    value, props.address, assetdef.getId(), assetdef.getColorSet().colorDescs[0])
}

/**
 * @callback PaymentRequestModel~getPaymentURI
 * @param {?Error} error
 * @param {string} uri
 */

/**
 * @param {PaymentRequestModel~getPaymentURI} cb
 */
PaymentRequestModel.prototype.getPaymentURI = function (cb) {
  var self = this

  if (self.paymentURI) { return cb(null, self.paymentURI) }

  var requestOpts = {
    method: 'POST',
    uri: 'http://' + self.props.cwpp_host + '/cwpp/new-request',
    body: JSON.stringify(self.cwppPayReq)
  }

  request(requestOpts, function (error, response, body) {
    if (error) { return cb(error) }

    if (response.statusCode !== 200) {
      return cb(new Error('request failed'))
    }

    var result = JSON.parse(body)
    self.paymentURI = cwpp.make_cwpp_uri(self.props.cwpp_host, result.hash)

    return cb(null, self.paymentURI)
  })
}

module.exports = PaymentRequestModel
