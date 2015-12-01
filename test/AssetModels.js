var _ = require('lodash')
var expect = require('chai').expect
var CCWallet = require('cc-wallet-core').Wallet
var Q = require('q')

var AssetModels = require('../src/AssetModels')
var AssetModel = require('../src/AssetModel')

describe('AssetModels', function () {
  this.timeout(30 * 1000)

  var wallet
  var assetModels

  beforeEach(function () {
    global.localStorage.clear()
    wallet = new CCWallet({
      testnet: true,
      blockchain: {name: 'Naive'},
      spendUnconfirmedCoins: true
    })
    wallet.on('error', function (error) {
      throw error
    })
    wallet.initialize('12355564466111166655222222222222')
    assetModels = new AssetModels({getWallet: _.constant(wallet)})
  })

  afterEach(function () {
    assetModels.removeListeners()
    assetModels = null
    wallet.getConnector().disconnect()
    wallet.removeListeners()
    wallet.clearStorage()
    wallet = null
  })

  it('instance of AssetModels', function () {
    expect(assetModels).to.be.instanceof(AssetModels)
  })

  it('getAssetModels return AssetModel[]', function () {
    return new Q.Promise(function (resolve) {
      assetModels.on('update', resolve)
    })
    .then(function () {
      var models = assetModels.getAssetModels()
      expect(models).to.be.instanceof(Array).with.to.have.length(1)
      expect(models[0]).to.be.instanceof(AssetModel)
    })
  })
})
