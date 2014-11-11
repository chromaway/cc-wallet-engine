var BIP39 = require('bip39')
var ccWallet = require('cc-wallet-core').Wallet
var CryptoJS = require('crypto-js')
var _ = require('lodash')
var store = require('store')
var cumulativeDelayed = require('delayed').cumulativeDelayed
var AssetModels = require('./AssetModels')
var JsonFormatter = require('./JsonFormatter')
var cwpp = require('./cwpp')
var CWPPPaymentModel = require('./CWPPPaymentModel')


/**
 * @class WalletEngine
 *
 * @param {Object} opts
 * @param {boolean} opts.testnet
 */
function WalletEngine(opts) {
  this.setCallback(function() {})
  this.assetModels = null

  opts = _.extend({
    testnet: false,
    blockchain: 'NaiveBlockchain'
  }, opts)
  this.ccWallet = new ccWallet(opts)

  if (this.ccWallet.isInitialized())
    this._initializeWalletEngine()
}

/**
 * @param {function} callback
 */
WalletEngine.prototype.setCallback = function(callback) {
  this.updateCallback = callback
}

/**
 * @return {string}
 */
WalletEngine.prototype.generateMnemonic = BIP39.generateMnemonic

/**
 * TODO rename to more fitting isCurrentSeed 
 * @return {boolean}
 */
WalletEngine.prototype.isCurrentMnemonic = function(mnemonic, password) {
  var seed = BIP39.mnemonicToSeedHex(mnemonic, password)
  return this.ccWallet.isCurrentSeed(seed)
}

/**
 * @return {boolean}
 */
WalletEngine.prototype.isInitialized = function() {
  return !!this.getSeed() && !!this.getPin() && this.ccWallet.isInitialized()
}

/**
 * @return {boolean}
 */
WalletEngine.prototype.hasPin = function() {
  return !!this._pin
}

/**
 * @return {string}
 */
WalletEngine.prototype.getPin = function() {
  return this._pin
}

/**
 * @return {string}
 * @throws {Error} If seed es not set
 */
WalletEngine.prototype.getPinEncrypted = function() {
  if (!this.hasSeed())
    throw new Error('No seed set')

  var encrypted = CryptoJS.AES.encrypt(
    this._pin,
    this.getSeed(),
    { format: JsonFormatter }
  )

  return encrypted.toString()
}

/**
 * @param {strin} pin
 * @throws {Error} If seed es not set
 */
WalletEngine.prototype.setPinEncrypted = function(encryptedPin) {
  if (!this.hasSeed())
    throw new Error('No seed set')

  var decrypted = CryptoJS.AES.decrypt(
    encryptedPin,
    this.getSeed(),
    { format: JsonFormatter }
  )
  this._pin = decrypted.toString(CryptoJS.enc.Utf8)
}

/**
 * @param {strin} pin
 */
WalletEngine.prototype.setPin = function(pin) {
  this._pin = pin
}

/**
 * @return {boolean}
 */
WalletEngine.prototype.hasSeed = function() {
  return !!this.getSeed()
}

/**
 * @return {string}
 */
WalletEngine.prototype.getSeed = function() {
  return this._seed
}

/**
 * @param {string} mnemonic
 * @param {string} [password]
 * @throws {Error} If wrong seed
 */
WalletEngine.prototype.setSeed = function(mnemonic, password) {
  if (!!this.ccWallet.isInitialized() && !this.isCurrentMnemonic(mnemonic, password))
    throw new Error('Wrong seed')

  // only ever store see here and only in ram
  this._seed = BIP39.mnemonicToSeedHex(mnemonic, password)
}

/**
 * @return {string}
 */
WalletEngine.prototype.stored_mnemonic = function() {
  return store.get('cc-wallet-engine__mnemonic')
}

/**
 * @return {string}
 */
WalletEngine.prototype.stored_encryptedpin = function() {
  return store.get('cc-wallet-engine__encryptedpin')
}

/**
 * @return {boolean}
 */
WalletEngine.prototype.canResetSeed = function() {
  return (
    !this.hasSeed() && 
    !!this.stored_mnemonic() && 
    !!this.stored_encryptedpin() && 
    this.ccWallet.isInitialized()
  )
}

WalletEngine.prototype.resetSeed = function(password) {
  if (!this.canResetSeed())
    throw new Error('Cannot reset seed!')

  this.setSeed(this.stored_mnemonic(), password)
  this.setPinEncrypted(this.stored_encryptedpin())
}

/**
 * @param {string} mnemonic
 * @param {string} [password]
 * @param {string} pin
 * @throws {Error} If already initialized
 */
WalletEngine.prototype.initialize = function(mnemonic, password, pin) {
  this.setSeed(mnemonic, password)
  this.ccWallet.initialize(this.getSeed())
  this._initializeWalletEngine()
  this.setPin(pin)
  store.set('cc-wallet-engine__mnemonic', mnemonic)
  store.set('cc-wallet-engine__encryptedpin', this.getPinEncrypted())
}

/**
 */
WalletEngine.prototype._initializeWalletEngine = function() {
  this.assetModels = new AssetModels(this.ccWallet, this)
  var delayedUpdate = cumulativeDelayed(function() { this.updateCallback() }.bind(this), 100)
  this.assetModels.on('update', delayedUpdate)
}

/**
 * @return {AssetModel[]}
 */
WalletEngine.prototype.getAssetModels = function() {
  if (!this.ccWallet.isInitialized())
    return []

  return this.assetModels.getAssetModels()
}

/**
 */
WalletEngine.prototype.getHistory = function () {
  if (!this.ccWallet.isInitialized())
    return []

  var assetsEntries = this.assetModels.getAssetModels().map(function(am) {
    return am.getHistory()
  })

  return _.flatten(assetsEntries)
}

/**
 */
WalletEngine.prototype.update = function() {
  if (this.ccWallet.isInitialized())
    this.assetModels.update()
}

/**
 * @callback WalletEngine~makePaymentFromURI
 * @param {?Error} error
 * @param {CWPPPaymentModel} paymentModel
 */

/**
 * @param {string} uri
 * @param {WalletEngine~makePaymentFromURI} cb
 */
WalletEngine.prototype.makePaymentFromURI = function(uri, cb) {
  if (!this.ccWallet.isInitialized())
    return cb(new Error('not initialized'))

  var paymentModel
  function callback(error) {
    return error ? cb(error) : cb(null, paymentModel)
  }

  if (cwpp.is_cwpp_uri(uri)) {
    paymentModel = new CWPPPaymentModel(this, uri)
    if (this.hasSeed())
      paymentModel.setSeed(this.getSeed())

    return paymentModel.initialize(callback)
  }

  try {
    var asset = this.assetModels.getAssetForURI(uri)
    if (!asset)
      return cb(new Error('Asset not recognized'))

    paymentModel = asset.makePaymentFromURI(uri)
    if (this.hasSeed())
      paymentModel.setSeed(this.getSeed())

    callback(null)

  } catch(error) {
    callback(error)

  }
}


module.exports = WalletEngine
