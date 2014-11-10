var events = require('events')
var util = require('util')
var cumulativeDelayed = require('delayed').cumulativeDelayed
var _ = require('lodash')

var AssetModel = require('./AssetModel')

var decode_bitcoin_uri = require('./uri_decoder').decode_bitcoin_uri


/**
 * @event AssetModels#update
 */

/**
 * @class AssetModels
 * @extends events.EventEmitter
 *
 * @param {cc-wallet-core.Wallet} wallet
 */
function AssetModels(wallet, walletEngine) {
  events.EventEmitter.call(this)

  this.models = {}
  this.wallet = wallet
  this.walletEngine = walletEngine

  //var delayedUpdate = cumulativeDelayed(function () {this.update()}.bind(this), 100)

  //this.wallet.getTxDb().on('update', delayedUpdate)
  //this.wallet.getTxDb().on('error', delayedUpdate)
}

util.inherits(AssetModels, events.EventEmitter)

/**
 * @return {AssetModel[]}
 */
AssetModels.prototype.getAssetModels = function() {
  var self = this

  var assetModels = Object.keys(self.models).sort().map(function(assetId) {
    return self.models[assetId]
  })

  return assetModels
}

/**
 * Add new models and update all
 */
AssetModels.prototype.update = function() {
  var self = this

  self.wallet.getAllAssetDefinitions().forEach(function(assetdef) {
    var assetId = assetdef.getId()
    if (!_.isUndefined(self.models[assetId]))
      return

    self.models[assetId] = new AssetModel(self.walletEngine, self.wallet, assetdef)
    self.models[assetId].on('update', function() { self.emit('update') })
    self.models[assetId].update()
    self.emit('update')
  })
}

/**
 * @param {string} uri
 * @return {?AssetModel}
 */
AssetModels.prototype.getAssetForURI = function(uri) {
  var params = decode_bitcoin_uri(uri)
  if (!params || !params.address)
    return null

  // by default assetId for bitcoin
  var assetId = params.asset_id || 'JNu4AFCBNmTE1'
  return this.models[assetId]
}


module.exports = AssetModels
