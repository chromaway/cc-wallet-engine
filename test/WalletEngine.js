var expect = require('chai').expect

var AssetModel = require('../src/AssetModel')
var WalletEngine = require('../src/WalletEngine')


describe('WalletEngine', function () {
  var walletEngine

  beforeEach(function () {
    localStorage.clear()
    walletEngine = new WalletEngine({
      testnet: true,
      networks: [{name: 'ElectrumJS', args: [{testnet: true}]}],
      blockchain: {name: 'Naive'},
      spendUnconfirmedCoins: true
    })
    walletEngine.on('error', function (error) { throw error })
  })

  afterEach(function () {
    walletEngine.getWallet().getNetwork().disconnect()
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

  it('getAssetModels', function (done) {
    walletEngine.setCallback(function () {
      walletEngine.getAssetModels().forEach(function (assetModel) {
        expect(assetModel).to.be.instanceof(AssetModel)
      })
      walletEngine.setCallback(function () {})
      done()
    })

    var mnemonic = walletEngine.generateMnemonic()
    var password = 'qwerty'
    walletEngine.initialize(mnemonic, password, '1234')
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
