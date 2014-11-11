var expect = require('chai').expect

var _ = require('lodash')
var ccWallet = require('cc-wallet-core').Wallet

var AssetModels = require('../src/AssetModels')
var AssetModel = require('../src/AssetModel')


describe('AssetModels', function() {
  var wallet, assetModels

  beforeEach(function() {
    localStorage.clear()
    wallet = new ccWallet({ testnet: true, blockchain: 'NaiveBlockchain' })
    wallet.initialize('12355564466111166655222222222222')
    assetModels = new AssetModels(wallet)
  })

  afterEach(function() {
    localStorage.clear()
    //wallet.clearStorage()
    wallet = undefined
  })

  it('instance of AssetModels', function() {
    expect(assetModels).to.be.instanceof(AssetModels)
  })

  it('getAssetModels return AssetModel[]', function(done) {
    assetModels.on('update', function() {
      if (_.isUndefined(done))
        return

      var models = assetModels.getAssetModels()
      expect(models).to.be.instanceof(Array).with.to.have.length(1)
      expect(models[0]).to.be.instanceof(AssetModel)

      done()
      done = undefined
    })
    assetModels.update()
  })
})
