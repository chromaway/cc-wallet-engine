var events = require('events')
var util = require('util')

var _ = require('lodash')

var HistoryEntryModel = require('./HistoryEntryModel')
var PaymentModel = require('./PaymentModel')
var PaymentRequestModel = require('./PaymentRequestModel')
var decode_bitcoin_uri = require('./uri_decoder').decode_bitcoin_uri


/**
 * @event AssetModel#error
 * @param {Error}
 */

/**
 * @event AssetModel#update
 */

/**
 * @class AssetModel
 * @extends events.EventEmitter
 * @param {WalletEngine} walletEngine
 * @param {cc-wallet-core.asset.AssetDefinition} assetdef
 */
function AssetModel(walletEngine, assetdef) {
  var self = this
  events.EventEmitter.call(self)

  self._wallet = walletEngine.getWallet()
  self._walletEngine = walletEngine
  self._assetdef = assetdef

  self.props = {
    moniker: '',
    address: '',
    unconfirmedBalance: '',
    availableBalance: '',
    totalBalance: '',
    historyEntries: []
  }

  self._wallet.on('newHeight', self._update.bind(self))
  self._wallet.on('updateTx', self._update.bind(self))
  self._wallet.on('touchAsset', function (assetdef) {
    if (self._assetdef.getId() === assetdef.getId()) { self._update() }
  })

  self._update()
}

util.inherits(AssetModel, events.EventEmitter)

/**
 * Update current AssetModel
 */
AssetModel.prototype._update = function () {
  var self = this

  var moniker = self._assetdef.getMonikers()[0]
  if (self.props.moniker !== moniker) {
    self.props.moniker = moniker
    self.emit('update')
  }

  var isBitcoin = (self._assetdef.getId() === 'JNu4AFCBNmTE1')
  var address = self._wallet.getSomeAddress(self._assetdef, !isBitcoin)
  if (self.props.address !== address) {
    self.props.address = address
    self.emit('update')
  }

  self._wallet.getBalance(self._assetdef, function (error, balance) {
    if (error !== null) { return self.emit('error', error) }

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
  })

  self._wallet.getHistory(self._assetdef, function (error, entries) {
    if (error !== null) { return self.emit('error', error) }

    function entryEqualFn(entry, index) { return entry.getTxId() === entries[index].getTxId() }
    var isEqual = self.props.historyEntries.length === entries.length && self.props.historyEntries.every(entryEqualFn)
    if (isEqual) { return }

    self.props.historyEntries = entries.map(function (entry) {
      return new HistoryEntryModel(entry)
    }).reverse()

    self.emit('update')
  })
}

/**
 * @return {cc-wallet-core.Wallet}
 */
AssetModel.prototype.getWallet = function () {
  return this._wallet
}

/**
 * @return {cc-wallet-core.asset.AssetDefinition}
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
 * @return {HistoryEntryModel[]}
 */
AssetModel.prototype.getHistory = function () {
  return this.props.historyEntries
}

/**
 * @return {PaymentModel}
 */
AssetModel.prototype.makePayment = function () {
  return new PaymentModel(this, this._walletEngine.getSeed())
}

/**
 * @return {PaymentRequestModel}
 */
AssetModel.prototype.makePaymentRequest = function (props) {
  return new PaymentRequestModel(this._wallet, this._assetdef, props)
}

/**
 * @callback AssetModel~makePaymentFromURI
 * @param {?Error} error
 * @param {PaymentModel} paymentModel
 */

/**
 * @param {string} uri
 * @param {AssetModel~makePaymentFromURI} cb

 * @return {PaymentModel}
 * @throws {Error}
 */
AssetModel.prototype.makePaymentFromURI = function (uri, cb) {
  var params = decode_bitcoin_uri(uri)
  if (params === null || _.isUndefined(params.address)) {
    return cb(new Error('wrong payment URI'))
  }

  // by default assetId for bitcoin
  var assetId = _.isUndefined(params.asset_id) ? 'JNu4AFCBNmTE1' : params.asset_id
  if (assetId !== this._assetdef.getId()) {
    return cb(new Error('wrong payment URI (wrong asset)'))
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
