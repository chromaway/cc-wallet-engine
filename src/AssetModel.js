var events = require('events')
var util = require('util')

var HistoryEntryModel = require('./HistoryEntryModel')
var PaymentModel = require('./PaymentModel')
var PaymentRequestModel = require('./PaymentRequestModel')
var _ = require('lodash')

var decode_bitcoin_uri = require('./uri_decoder').decode_bitcoin_uri


/**
 * @event AssetModel#update
 */

/**
 * @class AssetModel
 * @extends events.EventEmitter
 *
 * @param {cc-wallet-engine.WalletEngine} walletEngine
 * @param {cc-wallet-core.Wallet} wallet
 * @param {cc-wallet-core.asset.AssetDefinition} assetdef
 */
function AssetModel(walletEngine, wallet, assetdef) {
  var self = this

  events.EventEmitter.call(self)

  self.walletEngine = walletEngine
  self.wallet = wallet
  self.assetdef = assetdef

  self.props = {
    moniker: '',
    address: '',
    unconfirmedBalance: '',
    availableBalance: '',
    totalBalance: '',
    historyEntries: []
  }

  self.wallet.getCoinManager().on('touchAsset', function(assetdef) {
    if (self.assetdef.getId() === assetdef.getId()) { self.update() }
  })
}

util.inherits(AssetModel, events.EventEmitter)

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
AssetModel.prototype.getHistory = function() {
  return this.props.historyEntries
}

/**
 * @return {PaymentModel}
 */
AssetModel.prototype.makePayment = function() {
  return new PaymentModel(this, this.walletEngine.getSeed())
}

AssetModel.prototype.makePaymentRequest = function (props) {
    return new PaymentRequestModel(
        this.wallet, this.assetdef, props);
};

/**
 * @param {string} uri
 * @return {PaymentModel}
 * @throws {Error}
 */
AssetModel.prototype.makePaymentFromURI = function (uri) {
  var params = decode_bitcoin_uri(uri)
  if (!params || !params.address)
    throw new Error('wrong payment URI')

  // by default assetId for bitcoin
  var assetId = params.asset_id || 'JNu4AFCBNmTE1'
  if (assetId !== this.assetdef.getId())
    throw new Error('wrong payment URI (wrong asset)')

  var colorAddress = params.address
  if (assetId !== 'JNu4AFCBNmTE1')
    colorAddress = assetId + '@' + colorAddress

  var payment = this.makePayment()
  payment.addRecipient(colorAddress, params.amount)
  return payment
}

/**
 * Update current AssetModel
 */
AssetModel.prototype.update = function() {
  var self = this

  var moniker = self.assetdef.getMonikers()[0]
  if (self.props.moniker !== moniker) {
    self.props.moniker = moniker
    self.emit('update')
  }

  var isBitcoin = (self.assetdef.getId() == 'JNu4AFCBNmTE1')
  var address = self.wallet.getSomeAddress(self.assetdef, !isBitcoin)
  if (self.props.address !== address) {
    self.props.address = address
    self.emit('update')
  }

  function updateBalance(balanceName, balance) {
    var formattedBalance = self.assetdef.formatValue(balance)

    if (self.props[balanceName] !== formattedBalance) {
      self.props[balanceName] = formattedBalance
      self.emit('update')
    }
  }

  self.wallet.getUnconfirmedBalance(self.assetdef, function(error, balance) {
    if (error === null)
      updateBalance('unconfirmedBalance', balance)
    else console.log(error)
  })

  self.wallet.getAvailableBalance(self.assetdef, function(error, balance) {
    if (error === null)
      updateBalance('availableBalance', balance)
    else console.log(error)
  })

  self.wallet.getTotalBalance(self.assetdef, function(error, balance) {
    if (error === null)
      updateBalance('totalBalance', balance)
    else console.log(error)
  })

  self.wallet.getHistory(self.assetdef, function(error, entries) {
    if (error)
      return

    function entryEqualFn(entry, index) { return entry.getTxId() === entries[index].getTxId() }

    var isEqual = self.props.historyEntries.length === entries.length && self.props.historyEntries.every(entryEqualFn)
    if (isEqual)
        return

    self.props.historyEntries = entries.map(function(entry) { 
        return new HistoryEntryModel(entry)
    }).reverse()

    self.emit('update')
  })
}


module.exports = AssetModel
