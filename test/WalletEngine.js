var expect = require('chai').expect

var AssetModel = require('../src/AssetModel')
var WalletEngine = require('../src/WalletEngine')


describe('WalletEngine', function() {
  var walletEngine

  beforeEach(function() {
    walletEngine = new WalletEngine({ testnet: true })
  })

  afterEach(function() {
    walletEngine.ccWallet.clearStorage()
    delete walletEngine
  })

  it('generateMnemonic', function() {
    var mnemonic = walletEngine.generateMnemonic()
    expect(mnemonic).to.be.a('string')
    expect(mnemonic.split(' ').length % 3).to.equal(0)
  })

  it('initialize', function() {
    expect(walletEngine.isInitialized()).to.be.false
    var mnemonic = walletEngine.generateMnemonic(),
        password = 'qwerty'
    walletEngine.initialize(mnemonic, password)
    walletEngine.setPin('1234')
    expect(walletEngine.isInitialized()).to.be.true
  })

  it('getAssetModels', function(done) {
    var mnemonic = walletEngine.generateMnemonic(),
        password = 'qwerty'
    walletEngine.initialize(mnemonic, password)
    walletEngine.setPin('1234')

    walletEngine.setCallback(function() {
      walletEngine.getAssetModels().forEach(function(assetModel) {
        expect(assetModel).to.be.instanceof(AssetModel)
      })
      walletEngine.setCallback(function() {})
      done()
    })
    walletEngine.update()
  })
})
