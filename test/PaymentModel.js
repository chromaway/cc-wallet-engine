var expect = require('chai').expect

var BIP39 = require('bip39')

var WalletEngine = require('../src/WalletEngine')
var AssetModel = require('../src/AssetModel')


describe('PaymentModel', function () {
  var mnemonic = 'aerobic naive paper isolate volume coffee minimum crucial purse inmate winner cricket'
  var password = ''
  var seed = BIP39.mnemonicToSeedHex(mnemonic, password)

  var walletEngine
  var paymentModel

  beforeEach(function (done) {
    localStorage.clear()
    walletEngine = new WalletEngine({
      testnet: true,
      blockchain: 'NaiveBlockchain',
      storageSaveTimeout: 0,
      spendUnconfirmedCoins: true
    })
    walletEngine.getWallet().initialize(seed)
    walletEngine.getWallet().subscribeAndSyncAllAddresses(function (error) {
      expect(error).to.be.null

      var assetdef = walletEngine.getWallet().getAssetDefinitionByMoniker('bitcoin')
      var assetModel = new AssetModel(walletEngine, assetdef)
      assetModel.on('error', function (error) { throw error })

      var cnt = 0
      assetModel.on('update', function () {
        if (++cnt === 1) {
          paymentModel = assetModel.makePayment()
          done()
        }
      })
    })
  })

  afterEach(function () {
    paymentModel = undefined
    walletEngine.removeListeners()
    walletEngine.clearStorage()
    walletEngine = undefined
  })

  it('checkAddress return true', function () {
    var isValid = paymentModel.checkAddress('n2f687HTAW5R8pg6DRVHn5AS1a2hAK5WgW')
    expect(isValid).to.be.true
  })

  it('checkAddress return false', function () {
    var isValid = paymentModel.checkAddress('n2f687HTAW5R8pg6DRVHn5AS1a2hAK5Wg')
    expect(isValid).to.be.false
  })

  // @todo Return false, because all coins unconfirmed (this paymentModel involved in send coins below)
  it.skip('checkAmount return true', function () {
    var isValid = paymentModel.checkAmount('0.001')
    expect(isValid).to.be.true
  })

  it('checkAmount return false', function () {
    var isValid = paymentModel.checkAmount('1')
    expect(isValid).to.be.false
  })

  it('addRecipient not throw error', function () {
    var fn = function () { paymentModel.addRecipient('n2f687HTAW5R8pg6DRVHn5AS1a2hAK5WgW', '0.01') }
    expect(fn).to.not.throw(Error)
  })

  it('addRecipient throw error', function () {
    paymentModel.readOnly = true
    var fn = function () { paymentModel.addRecipient('n2f687HTAW5R8pg6DRVHn5AS1a2hAK5WgW', '0.01') }
    expect(fn).to.throw(Error)
  })

  it('send', function (done) {
    paymentModel.addRecipient('n2f687HTAW5R8pg6DRVHn5AS1a2hAK5WgW', '0.001')
    paymentModel.setSeed(seed)
    paymentModel.send(function (error) {
      expect(error).to.be.null
      done()
    })
  })

  it('send throw error (payment already sent)', function () {
    paymentModel.readOnly = true
    expect(paymentModel.send).to.throw(Error)
  })

  it('send throw error (recipient is empty)', function () {
    expect(paymentModel.send).to.throw(Error)
  })

  it('send throw error (mnemonic not set)', function () {
    paymentModel.addRecipient('n2f687HTAW5R8pg6DRVHn5AS1a2hAK5WgW', '0.01')
    expect(paymentModel.send).to.throw(Error)
  })

  it('getStatus return fresh', function () {
    expect(paymentModel.getStatus()).to.equal('fresh')
  })
})
