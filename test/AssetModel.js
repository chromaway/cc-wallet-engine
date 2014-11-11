var expect = require('chai').expect

var WalletEngine = require('../src/WalletEngine')
var AssetModel = require('../src/AssetModel')
var HistoryEntryModel = require('../src/HistoryEntryModel')


describe('AssetModel', function() {
  var walletEngine

  beforeEach(function(done) {
    localStorage.clear()
    walletEngine = new WalletEngine({ testnet: true, blockchain: 'NaiveBlockchain' })
    walletEngine.ccWallet.initialize('12355564466111166655222222222222')
    walletEngine.ccWallet.subscribeAndSyncAllAddresses(function(error) {
      expect(error).to.be.null
      done()
    })
  })

  afterEach(function() {
    localStorage.clear()
    //walletEngine.ccWallet.clearStorage()
    walletEngine = undefined
  })

  it('bitcoin AssetModel', function(done) {
    var assetdef = walletEngine.ccWallet.getAssetDefinitionByMoniker('bitcoin')
    var assetModel = new AssetModel(walletEngine, walletEngine.ccWallet, assetdef)
    var cnt = 0
    assetModel.on('update', function() {
      if (++cnt !== 6)
        return

      expect(assetModel.getMoniker()).to.equal('bitcoin')
      expect(assetModel.getAddress()).to.equal('mv4jLE114t8KHL3LExNGBTXiP2dCjkaWJh')
      expect(assetModel.getUnconfirmedBalance()).to.equal('0.00000000')
      expect(assetModel.getAvailableBalance()).to.equal('0.01000000')
      expect(assetModel.getTotalBalance()).to.equal('0.01000000')
      expect(assetModel.getHistory()).to.be.instanceof(Array).with.to.have.length(1)
      expect(assetModel.getHistory()[0]).to.be.instanceof(HistoryEntryModel)

      done()
    })
    assetModel.update()
  })
})
