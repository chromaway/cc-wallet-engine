var expect = require('chai').expect

var ccWallet = require('cc-wallet-core').Wallet
var Q = require('q')

var AssetModels = require('../src/AssetModels')
var AssetModel = require('../src/AssetModel')


describe('AssetModels', function () {
  var wallet
  var assetModels

  beforeEach(function () {
    localStorage.clear()
    wallet = new ccWallet({
      testnet: true,
      blockchain: 'NaiveBlockchain',
      storageSaveTimeout: 0,
      spendUnconfirmedCoins: true
    })
    wallet.on('error', function (error) { throw error })
    wallet.initialize('12355564466111166655222222222222')
    assetModels = new AssetModels({getWallet: function () { return wallet }})
  })

  afterEach(function () {
    assetModels.removeListeners()
    assetModels = undefined
    wallet.removeListeners()
    wallet.clearStorage()
    wallet = undefined
  })

  it('instance of AssetModels', function () {
    expect(assetModels).to.be.instanceof(AssetModels)
  })

  it('getAssetModels return AssetModel[]', function (done) {
    var deferred = Q.defer()
    deferred.promise.then(function () {
      var models = assetModels.getAssetModels()
      expect(models).to.be.instanceof(Array).with.to.have.length(1)
      expect(models[0]).to.be.instanceof(AssetModel)
      done()
    })
    assetModels.on('update', deferred.resolve)
  })
})
