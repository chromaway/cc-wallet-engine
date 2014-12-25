var events = require('events')
var util = require('util')

var _ = require('lodash')
var SyncMixin = require('cc-wallet-core').util.SyncMixin

var AssetModel = require('./AssetModel')
var decode_bitcoin_uri = require('./uri_decoder').decode_bitcoin_uri


/**
 * @event AssetModels#error
 * @param {Error}
 */

/**
 * @event AssetModels#update
 */

/**
 * @event AssetModels#syncStart
 */

/**
 * @event AssetModels#syncStop
 */

/**
 * @class AssetModels
 * @extends external:events.EventEmitter
 * @mixins external:cc-wallet-core.util.SyncMixin
 * @param {walletEngine} walletEngine
 */
function AssetModels(walletEngine) {
  var self = this
  events.EventEmitter.call(self)
  SyncMixin.call(self)

  self._models = {}
  self._walletEngine = walletEngine

  walletEngine.getWallet().getAllAssetDefinitions().forEach(self._addAssetModel.bind(self))
  walletEngine.getWallet().on('newAsset', self._addAssetModel.bind(self))
}

util.inherits(AssetModels, events.EventEmitter)

/**
 * @param {external:cc-wallet-core.AssetDefinition} assetdef
 */
AssetModels.prototype._addAssetModel = function (assetdef) {
  var self = this

  var assetId = assetdef.getId()
  if (!_.isUndefined(self._models[assetId])) { return }

  var assetModel = new AssetModel(self._walletEngine, assetdef)
  assetModel.on('error', function (error) { self.emit('error', error) })
  assetModel.on('update', function () { self.emit('update') })
  assetModel.on('syncStart', function () { self._syncEnter() })
  assetModel.on('syncStop', function () { self._syncExit() })

  self._models[assetId] = assetModel

  self.emit('update')
}

/**
 * @return {AssetModel[]}
 */
AssetModels.prototype.getAssetModels = function () {
  return _.values(this._models)
}

/**
 * @param {string} uri
 * @return {?AssetModel}
 */
AssetModels.prototype.getAssetForURI = function (uri) {
  var params = decode_bitcoin_uri(uri)
  if (params === null || _.isUndefined(params.address)) { return null }

  // by default assetId for bitcoin
  var assetId = _.isUndefined(params.asset_id) ? 'JNu4AFCBNmTE1' : params.asset_id
  return this._models[assetId] || null
}

/**
 * @param {string} assetId
 * @return {?AssetModel}
 */
AssetModels.prototype.getAssetById = function (assetId) {
  return this._models[assetId] || null
}

/**
 */
AssetModels.prototype.removeListeners = function () {
  this.removeAllListeners()
  this.getAssetModels().forEach(function (am) { am.removeAllListeners() })
}


module.exports = AssetModels
