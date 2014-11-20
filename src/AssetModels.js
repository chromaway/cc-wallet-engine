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

/**
 * @param {AssetDefinition}
 */
AssetModels.prototype._addAssetModel = function (assetdef) {
  var self = this

  var assetId = assetdef.getId()
  if (!_.isUndefined(self._models[assetId])) { return }

  var assetModel = new AssetModel(self._walletEngine, assetdef)
  assetModel.on('error', function (error) { self.emit('error', error) })
  assetModel.on('update', function () { self.emit('update') })

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
  if (!params || !params.address)
    return null

  // by default assetId for bitcoin
  var assetId = params.asset_id || 'JNu4AFCBNmTE1'
  return this._models[assetId] || null
}

/**
 */
AssetModels.prototype.removeListeners = function () {
  this.removeAllListeners()
  this.getAssetModels().forEach(function (am) { am.removeAllListeners() })
}


module.exports = AssetModels
