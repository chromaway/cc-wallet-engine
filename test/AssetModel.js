var expect = require('chai').expect

var WalletEngine = require('../src/WalletEngine')
var AssetModel = require('../src/AssetModel')


describe('AssetModel', function () {
  var walletEngine

  beforeEach(function () {
    localStorage.clear()
    walletEngine = new WalletEngine({
      testnet: true,
      blockchain: 'NaiveBlockchain',
      storageSaveTimeout: 0,
      spendUnconfirmedCoins: true
    })
    walletEngine.getWallet().initialize('12355564466111166655222222222222')
    walletEngine._initializeWalletEngine()
    walletEngine.on('error', function (error) { throw error })
  })

  afterEach(function () {
    walletEngine.removeListeners()
    walletEngine.clearStorage()
    walletEngine = undefined
  })

  it('bitcoin AssetModel', function (done) {
    var assetdef = walletEngine.getWallet().getAssetDefinitionByMoniker('bitcoin')
    var assetModel = new AssetModel(walletEngine, assetdef)
    assetModel.on('error', function (error) { throw error })

    var cnt = 0
    assetModel.on('update', function () {
      if (++cnt !== 2) { return }

      expect(assetModel.getMoniker()).to.equal('bitcoin')
      expect(assetModel.getAddress()).to.equal('mv4jLE114t8KHL3LExNGBTXiP2dCjkaWJh')
      expect(assetModel.getUnconfirmedBalance()).to.equal('0.00000000')
      expect(assetModel.getAvailableBalance()).to.equal('0.01000000')
      expect(assetModel.getTotalBalance()).to.equal('0.01000000')

      done()
    })
  })
})
