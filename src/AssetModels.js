var events = require('events')
var util = require('util')

var _ = require('lodash')

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
 * @class AssetModels
 * @extends events.EventEmitter
 *
 * @param {walletEngine} walletEngine
 */
function AssetModels(walletEngine) {
  var self = this
  events.EventEmitter.call(self)

  self._models = {}
  self._walletEngine = walletEngine

  walletEngine.getWallet().getAllAssetDefinitions().forEach(self._addAssetModel.bind(self))
  walletEngine.getWallet().on('newAsset', self._addAssetModel.bind(self))
}

util.inherits(AssetModels, events.EventEmitter)

AssetModels.prototype.isUpdating = function () {
    return _.any(this._models, function (model) { return model.isUpdating() });
}

/**
 * @param {AssetDefinition} assetdef
 */
AssetModels.prototype._addAssetModel = function (assetdef) {
  var self = this

  var assetId = assetdef.getId()
  if (!_.isUndefined(self._models[assetId])) { return }

  var assetModel = new AssetModel(self._walletEngine, assetdef)
  assetModel.on('error', function (error) { self.emit('error', error) })
  assetModel.on('update', function () { self.emit('update') })
  // it isn't a problem that these events are emitted more often than necessary
  // as WalletEngine will be able to detect whether update is still in progress
  // via isUpdating() 
  assetModel.on('beginUpdating', function () { self.emit('update') })
  assetModel.on('endUpdating', function () { self.emit('update') })

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
