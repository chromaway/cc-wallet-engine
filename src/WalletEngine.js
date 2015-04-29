var events = require('events')
var util = require('util')

var BIP39 = require('bip39')
var ccWallet = require('cc-wallet-core').Wallet
var CryptoJS = require('crypto-js')
var store = require('store')
var cccoreUtil = require('cc-wallet-core').util

var AssetModels = require('./AssetModels')
var JsonFormatter = require('./JsonFormatter')
var cwpp = require('./cwpp')
var CWPPPaymentModel = require('./CWPPPaymentModel')
var HistoryEntryModel = require('./HistoryEntryModel')
var errors = require('./errors')


/**
 * @event WalletEngine#error
 * @param {Error}
 */

/**
 * @event WalletEngine#update
 */

/**
 * @event AssetModels#syncStart
 */

/**
 * @event AssetModels#syncStop
 */

/**
 * @class WalletEngine
 * @extends external:events.EventEmitter
 * @mixins external:cc-wallet-core.util.SyncMixin
 * @param {Object} [opts] See opts in cc-wallet-core.Wallet
 */
function WalletEngine(opts) {
  var self = this
  events.EventEmitter.call(self)
  self.setMaxListeners(100) // 10 by default, 0 -- unlimited
  cccoreUtil.SyncMixin.call(self)
  self._opts = opts
  self.setCallback(function () {})
  self._createWallet()
}

util.inherits(WalletEngine, events.EventEmitter)

WalletEngine.prototype._createWallet = function () {
  var self = this
  self._assetModels = null
  self._historyEntries = []

  self._wallet = new ccWallet(self._opts)
  self._wallet.on('error', function (error) { self.emit('error', error) })
  self._wallet.on('syncStart', function () { self._syncEnter() })
  self._wallet.on('syncStop', function () { self._syncExit() })

  self._wallet.getConnector().on('newReadyState', self._update.bind(self))

  // note: we update right away on syncStart, but use debounce on syncStop
  self.on('syncStart', function () { self._updateCallback() })
  self.on('syncStop', function () { self._delayedUpdateCallback() })

  if (self._wallet.isInitialized()) {
    self._initializeWalletEngine()
  }
}

WalletEngine.prototype.isConnected = function () {
  return this._wallet.getConnector().isConnected()
}

WalletEngine.prototype.isUpdating = function () {
  return (!this.isConnected()) || this.isSyncing()
}

/**
 * @return {external:cc-wallet-core.Wallet}
 */
WalletEngine.prototype.getWallet = function () {
  return this._wallet
}

/**
 * @callback WalletEngine~setCallbackCallback
 */

/**
 * @param {WalletEngine~setCallbackCallback} callback
 */
WalletEngine.prototype.setCallback = function (callback) {
  this._updateCallback = callback
  this._delayedUpdateCallback = cccoreUtil.debounce(callback, 100)
}

/**
 */
WalletEngine.prototype._update = function () {
  // callback is called automatically on syncStop,
  // so we only call callback when not syncing
  if (!this.isSyncing()) {
    this._delayedUpdateCallback()
  }
}

/**
 * @return {boolean}
 */
WalletEngine.prototype.isInitialized = function () {
  return !!this.getSeed() && !!this.getPin() && this._wallet.isInitialized()
}

/**
 * @param {string} mnemonic
 * @param {string} [password]
 * @param {string} pin
 * @throws {Error} If already initialized
 */
WalletEngine.prototype.initialize = function (mnemonic, password, pin) {
  // @todo AlreadyInitialize check?
  this.setSeed(mnemonic, password)
  this._wallet.initialize(this.getSeed())
  this._initializeWalletEngine()
  this.setPin(pin)
  store.set('cc-wallet-engine__mnemonic', mnemonic)
  store.set('cc-wallet-engine__encryptedpin', this.getPinEncrypted())
}

/**
 */
WalletEngine.prototype._initializeWalletEngine = function () {
  var self = this

  self._assetModels = new AssetModels(self)
  self._assetModels.on('error', function (error) { self.emit('error', error) })
  self._assetModels.on('update', function () { self._update() })
  self._assetModels.on('syncStart', function () { self._syncEnter() })
  self._assetModels.on('syncStop', function () { self._syncExit() })

  function updateHistory() {
    var entries = self._wallet.getHistory()

    function entryEqualFn(entry, index) { return entry.getHistoryEntry().isEqual(entries[index]) }
    var isEqual = self._historyEntries.length === entries.length && self._historyEntries.every(entryEqualFn)
    if (isEqual) { return }

    self._historyEntries = entries.map(function (entry) {
      return new HistoryEntryModel(entry)
    }).reverse()

    self._update()
  }

  var historyUpdateTrigger = true
  self._wallet.on('historyUpdate', function () { historyUpdateTrigger = true })
  self._wallet.on('syncStop', function () {
    if (historyUpdateTrigger) {
      updateHistory()
      historyUpdateTrigger = false
    }
  })
}

WalletEngine.prototype.forceRefresh = function () {
  var network = this._wallet.getConnector()
  if (network.isConnected()) {
    network.refresh()
  }
}

WalletEngine.prototype.connect = function () {
  this._wallet.connect()
}

WalletEngine.prototype.disconnect = function () {
  this._wallet.disconnect()
}


/**
 * @return {string}
 */
WalletEngine.prototype.generateMnemonic = BIP39.generateMnemonic

/**
 * @param {string} mnemonic
 * @param {string} password
 * @return {boolean}
 */
// @todo Rename to more fitting isCurrentSeed
WalletEngine.prototype.isCurrentMnemonic = function (mnemonic, password) {
  var seed = BIP39.mnemonicToSeedHex(mnemonic, password)
  return this._wallet.isCurrentSeed(seed)
}

/**
 * @return {boolean}
 */
WalletEngine.prototype.hasPin = function () {
  return !!this._pin
}

/**
 * @return {string}
 */
WalletEngine.prototype.getPin = function () {
  return this._pin
}

/**
 * @return {string}
 * @throws {Error} If seed es not set
 */
WalletEngine.prototype.getPinEncrypted = function () {
  this.seedCheck()

  var encrypted = CryptoJS.AES.encrypt(
    this._pin, this.getSeed(), {format: JsonFormatter})

  return encrypted.toString()
}

/**
 * @param {strin} encryptedPin
 * @throws {Error} If seed es not set
 */
WalletEngine.prototype.setPinEncrypted = function (encryptedPin) {
  this.seedCheck()

  var decrypted = CryptoJS.AES.decrypt(
    encryptedPin, this.getSeed(), {format: JsonFormatter})

  this._pin = decrypted.toString(CryptoJS.enc.Utf8)
}

/**
 * @param {string} pin
 */
WalletEngine.prototype.setPin = function (pin) {
  this._pin = pin
}

/**
 * @return {boolean}
 */
WalletEngine.prototype.hasSeed = function () {
  return !!this.getSeed()
}

/**
 * @throws {SeedIsUndefinedError}
 */
WalletEngine.prototype.seedCheck = function () {
  if (!this.hasSeed()) {
    throw new errors.SeedIsUndefinedError()
  }
}

/**
 * @return {string}
 */
WalletEngine.prototype.getSeed = function () {
  return this._seed
}

/**
 * @param {string} mnemonic
 * @param {string} [password]
 * @throws {Error} If wrong seed
 */
WalletEngine.prototype.setSeed = function (mnemonic, password) {
  if (!!this._wallet.isInitialized() && !this.isCurrentMnemonic(mnemonic, password)) {
    throw new errors.WrongSeedError()
  }

  // only ever store see here and only in ram
  this._seed = BIP39.mnemonicToSeedHex(mnemonic, password)
}

/**
 * @return {string}
 */
WalletEngine.prototype.stored_mnemonic = function () {
  return store.get('cc-wallet-engine__mnemonic')
}

/**
 * @return {string}
 */
WalletEngine.prototype.stored_encryptedpin = function () {
  return store.get('cc-wallet-engine__encryptedpin')
}

/**
 * @return {boolean}
 */
WalletEngine.prototype.canResetSeed = function () {
  return (
    !this.hasSeed() &&
    !!this.stored_mnemonic() &&
    !!this.stored_encryptedpin() &&
    this._wallet.isInitialized()
  )
}

/**
 * @param {string} password
 * @throws {CannotResetSeedError}
 */
WalletEngine.prototype.resetSeed = function (password) {
  if (!this.canResetSeed()) {
    throw new errors.CannotResetSeedError()
  }

  this.setSeed(this.stored_mnemonic(), password)
  this.setPinEncrypted(this.stored_encryptedpin())
}

/**
 * @return {AssetModel[]}
 */
WalletEngine.prototype.getAssetModels = function () {
  if (!this._wallet.isInitialized()) { return [] }

  return this._assetModels.getAssetModels()
}

/*
 * @param {string} assetId
 * @return {AssetModel}
 */
WalletEngine.prototype.getAssetModelById = function (assetId) {
  this._wallet.isInitializedCheck()
  return this._assetModels.getAssetById(assetId)
}

/**
 */
WalletEngine.prototype.getHistory = function () {
  return this._historyEntries
}

/**
 * @callback WalletEngine~makePaymentFromURICallback
 * @param {?Error} error
 * @param {CWPPPaymentModel} paymentModel
 */

/**
 * @param {string} uri
 * @param {WalletEngine~makePaymentFromURICallback} cb
 */
WalletEngine.prototype.makePaymentFromURI = function (uri, cb) {
  var self = this
  self._wallet.isInitializedCheck()

  if (cwpp.is_cwpp_uri(uri)) {
    var paymentModel = new CWPPPaymentModel(self, uri)
    if (self.hasSeed()) {
      paymentModel.setSeed(self.getSeed())
    }

    return paymentModel.initialize(function (error) { cb(error, paymentModel) })
  }

  var asset = self._assetModels.getAssetForURI(uri)
  if (asset === null) {
    return cb(new errors.AssetNotRecognizedError('WalletEngine.makePaymentFromURI'))
  }

  asset.makePaymentFromURI(uri, function (error, paymentModel) {
    if (error === null && self.hasSeed()) {
      paymentModel.setSeed(self.getSeed())
    }

    cb(error, paymentModel)
  })
}

/**
 */
WalletEngine.prototype.removeListeners = function () {
  this.removeAllListeners()
  this._wallet.removeListeners()
  if (this.isInitialized()) { this._assetModels.removeListeners() }
}

/**
 */
WalletEngine.prototype.clearStorage = function () {
  this._wallet.clearStorage()
  store.remove('cc-wallet-engine__mnemonic')
  store.remove('cc-wallet-engine__encryptedpin')
  this._wallet.removeListeners()
  if (this.isInitialized()) { this._assetModels.removeListeners() }
  this._createWallet()
}


WalletEngine.prototype._getSyncingStatus = function () {
  var w = this.getWallet();
  var syncingObjects = {
    WalletEngine: this,
    Wallet: w,
    Blockchain: w.getBlockchain(),
    WalletEventNotifier: w.walletEventNotifier,
    WalletStateManager: w.getStateManager()
  };

  return syncingObjects.map(function (obj) {
    return obj.isSyncing()
  })
}

module.exports = WalletEngine
