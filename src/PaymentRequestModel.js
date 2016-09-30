var request = require('request')
var Q = require('q')
var stringify = require('json-stable-stringify')

var errors = require('./errors')
var cwpp = require('./cwpp')

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
    this.paymentURI = null

    this.wallet = wallet
    this.assetdef = assetdef
    this.props = props

    if (props.address === undefined) {
        props.address = wallet.getSomeAddress(assetdef, false)
    } else {
        // need uncolored address
        props.address = wallet.getBitcoinAddress(props.address)
    }

    if (props.cwpp_host === undefined) {
        var networkName = this.wallet.getNetworkName()
        // use the first character of networkName, l for livenet and t for testnet
        props.cwpp_host = networkName[0] + '.cwpp.chromapass.net'
    }

    var value = assetdef.parseValue(props.amount)
    this.cwppPayReq = cwpp.make_cinputs_payment_request(
      value, props.address, assetdef.getId(), assetdef.getColorSet().getColorDescs()[0])

    if (props.nickname)
        this.cwppPayReq.nickname = props.nickname;
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
    var self = this
    if (self.paymentURI === null) {
        var requestOpts = {
            method: 'POST',
            uri: 'http://' + self.props.cwpp_host + '/cwpp/new-request',
            body: stringify(self.cwppPayReq),
            json: true
        }

        self.paymentURI = Q.nfcall(request, requestOpts)
          .spread(function (response, body) {
              if (response.statusCode !== 200) {
                  throw new errors.RequestError('PaymentRequestModel: ' + response.statusMessage)
              }

              if ((body.hash !== cwpp.hashMessage_long(self.cwppPayReq) &&
                  (body.hash !== cwpp.hashMessage_short(self.cwppPayReq)))) {
                  throw new errors.RequestError('PaymentRequest hash doesn\'t match')
              }

              return cwpp.make_cwpp_uri(self.props.cwpp_host, body.hash)
          })
    }

    self.paymentURI
      .then(function (uri) { cb(null, uri) },
            function (err) { cb(err) })
}

module.exports = PaymentRequestModel
