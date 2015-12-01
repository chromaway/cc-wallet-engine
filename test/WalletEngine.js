var expect = require('chai').expect
var Q = require('q')

var AssetModel = require('../src/AssetModel')
var WalletEngine = require('../src/WalletEngine')

describe('WalletEngine', function () {
  this.timeout(30 * 1000)

  var walletEngine

  beforeEach(function () {
    global.localStorage.clear()
    walletEngine = new WalletEngine({
      testnet: true,
      blockchain: {name: 'Naive'},
      spendUnconfirmedCoins: true
    })
    walletEngine.on('error', function (error) { throw error })
  })

  afterEach(function () {
    walletEngine.getWallet().getConnector().disconnect()
    walletEngine.removeListeners()
    walletEngine.clearStorage()
    walletEngine = null
  })

  it('generateMnemonic', function () {
    var mnemonic = walletEngine.generateMnemonic()
    expect(mnemonic).to.be.a('string')
    expect(mnemonic.split(' ').length % 3).to.equal(0)
  })

  it('initialize', function () {
    var mnemonic = walletEngine.generateMnemonic()
    var password = 'qwerty'

    expect(walletEngine.isInitialized()).to.be.false
    walletEngine.initialize(mnemonic, password, '1234')
    expect(walletEngine.isInitialized()).to.be.true
  })

  it('getAssetModels', function () {
    return new Q.Promise(function (resolve, reject) {
      var mnemonic = walletEngine.generateMnemonic()
      var password = 'qwerty'
      walletEngine.initialize(mnemonic, password, '1234')

      walletEngine.setCallback(function () {
        try {
          walletEngine.getAssetModels().forEach(function (assetModel) {
            expect(assetModel).to.be.instanceof(AssetModel)
          })
          resolve()
        } catch (err) {
          reject(err)
        } finally {
          walletEngine.setCallback(function () {})
        }
      })
    })
  })

  it('re-initialize', function () {
    var mnemonic = walletEngine.generateMnemonic()
    var password = 'qwerty'

    walletEngine.initialize(mnemonic, password, '1234')

    walletEngine.clearStorage()

    var newMnemonic = walletEngine.generateMnemonic()
    var newPassword = 'hello'

    walletEngine.initialize(newMnemonic, newPassword, '9000')
    expect(walletEngine.isInitialized()).to.be.true
  })
})
