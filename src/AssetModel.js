var events = require('events')
var util = require('util')

var _ = require('lodash')
var Q = require('q')
var cccoreUtil = require('cc-wallet-core').util

var PaymentModel = require('./PaymentModel')
var PaymentRequestModel = require('./PaymentRequestModel')
var decode_bitcoin_uri = require('./uri_decoder').decode_bitcoin_uri
var errors = require('./errors')


/**
 * @event AssetModel#error
 * @param {Error}
 */

/**
 * @event AssetModel#update
 */

/**
 * @event AssetModel#syncStart
 */

/**
 * @event AssetModel#syncStop
 */

/**
 * @class AssetModel
 * @extends external:events.EventEmitter
 * @mixins external:cc-wallet-core.util.SyncMixin
 * @param {WalletEngine} walletEngine
 * @param {external:cc-wallet-core.AssetDefinition} assetdef
 */
function AssetModel(walletEngine, assetdef) {
  var self = this
  events.EventEmitter.call(self)
  cccoreUtil.SyncMixin.call(self)

  self._wallet = walletEngine.getWallet()
  self._walletEngine = walletEngine
  self._assetdef = assetdef

  var moniker = self._assetdef.getMonikers()[0]
  var isBitcoin = (self._assetdef.getId() === 'JNu4AFCBNmTE1')
  var address = self._wallet.getSomeAddress(self._assetdef, !isBitcoin)
  self.props = {
    moniker: moniker,
    address: address,
    unconfirmedBalance: '',
    availableBalance: '',
    totalBalance: ''
  }

  var updateState = {isUpdating: false, isStillNeedUpdate: false}
  var update = cccoreUtil.debounce(function () {
    if (updateState.isUpdating) {
      return (updateState.isStillNeedUpdate = true)
    }

    function updateOnce() {
      updateState.isUpdating = true
      updateState.isStillNeedUpdate = false

      self._update().finally(function () {
        if (updateState.isStillNeedUpdate) {
          return updateOnce()
        }

        updateState.isUpdating = false
      })
    }
    updateOnce()

  }, 100)

  self._wallet.on('updateTx', function () { update() })
  self._wallet.on('touchAsset', function (assetdef) {
    if (self._assetdef.getId() === assetdef.getId()) { update() }
  })

  update()
}

util.inherits(AssetModel, events.EventEmitter)

/**
 * @return {external:Q.Promise}
 */
AssetModel.prototype._update = function () {
  var self = this

  return Q.ninvoke(self._wallet, 'getBalance', self._assetdef).then(function (balance) {
    var isChanged = false
    function updateBalance(balanceType, value) {
      var formattedValue = self._assetdef.formatValue(value)
      if (self.props[balanceType] !== formattedValue) {
        self.props[balanceType] = formattedValue
        isChanged = true
      }
    }

    updateBalance('totalBalance', balance.total)
    updateBalance('availableBalance', balance.available)
    updateBalance('unconfirmedBalance', balance.unconfirmed)

    if (isChanged) { self.emit('update') }

  }).catch(function (error) {
    self.emit('error', error)

  })
}

/**
 * @return {external:cc-wallet-core.Wallet}
 */
AssetModel.prototype.getWallet = function () {
  return this._wallet
}

/**
 * @return {external:cc-wallet-core.AssetDefinition}
 */
AssetModel.prototype.getAssetDefinition = function () {
  return this._assetdef
}

/**
 * @return {string}
 */
AssetModel.prototype.getMoniker = function () {
  return this.props.moniker
}

/**
 * @return {string}
 */
AssetModel.prototype.getAddress = function () {
  return this.props.address
}

/**
 * @return {string}
 */
AssetModel.prototype.getUnconfirmedBalance = function () {
  return this.props.unconfirmedBalance
}

/**
 * @return {string}
 */
AssetModel.prototype.getAvailableBalance = function () {
  return this.props.availableBalance
}

/**
 * @return {string}
 */
AssetModel.prototype.getTotalBalance = function () {
  return this.props.totalBalance
}

/**
 * @return {PaymentModel}
 */
AssetModel.prototype.makePayment = function () {
  return new PaymentModel(this, this._walletEngine.getSeed())
}

/**
 * @param {Object} props
 * @return {PaymentRequestModel}
 */
AssetModel.prototype.makePaymentRequest = function (props) {
  return new PaymentRequestModel(this._wallet, this._assetdef, props)
}

/**
 * @callback AssetModel~makePaymentFromURICallback
 * @param {?Error} error
 * @param {PaymentModel} paymentModel
 */

/**
 * @param {string} uri
 * @param {AssetModel~makePaymentFromURICallback} cb
 */
AssetModel.prototype.makePaymentFromURI = function (uri, cb) {
  var params = decode_bitcoin_uri(uri)
  if (params === null) {
    return cb(new errors.PaymentURIError('wrong params'))
  }

  if (_.isUndefined(params.address)) {
    return cb(new errors.PaymentURIError('wrong address'))
  }

  // by default assetId for bitcoin
  var assetId = _.isUndefined(params.asset_id) ? 'JNu4AFCBNmTE1' : params.asset_id
  if (assetId !== this._assetdef.getId()) {
    return cb(new errors.PaymentURIError('wrong asset_id'))
  }

  var colorAddress = params.address
  if (assetId !== 'JNu4AFCBNmTE1') {
    colorAddress = assetId + '@' + colorAddress
  }

  var payment = this.makePayment()
  payment.addRecipient(colorAddress, params.amount)
  cb(null, payment)
}


module.exports = AssetModel
