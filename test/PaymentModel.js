var expect = require('chai').expect

var BIP39 = require('bip39')
var ccWallet = require('cc-wallet-core').Wallet

var AssetModel = require('../src/AssetModel')
var PaymentModel = require('../src/PaymentModel')


describe.skip('PaymentModel', function() {
  var mnemonic = 'aerobic naive paper isolate volume coffee minimum crucial purse inmate winner cricket'
  var password = ''
  var seed = BIP39.mnemonicToSeedHex(mnemonic, password)

  var wallet, assetModel, paymentModel

  beforeEach(function(done) {
    wallet = new ccWallet({ testnet: true, blockchain: 'NaiveBlockchain' })
    wallet.initialize(seed)
    wallet.fullScanAllAddresses(function(error) { // subscribeAndSyncAll
      expect(error).to.be.null

      var cnt = 0
      assetModel = new AssetModel(wallet, wallet.getAssetDefinitionByMoniker('bitcoin'))
      assetModel.on('update', function() {
        if (++cnt === 6) {
          paymentModel = assetModel.makePayment()
          done()
        }
      })
      assetModel.update()
    })
  })

  afterEach(function() {
    wallet.clearStorage()
  })

  it('checkAddress return true', function() {
    var isValid = paymentModel.checkAddress('n2f687HTAW5R8pg6DRVHn5AS1a2hAK5WgW')
    expect(isValid).to.be.true
  })

  it('checkAddress return false', function() {
    var isValid = paymentModel.checkAddress('n2f687HTAW5R8pg6DRVHn5AS1a2hAK5Wg')
    expect(isValid).to.be.false
  })

  it('checkAmount return true', function() {
    var isValid = paymentModel.checkAmount('0.001')
    expect(isValid).to.be.true
  })

  it('checkAmount return false', function() {
    var isValid = paymentModel.checkAmount('1')
    expect(isValid).to.be.false
  })

  it('checkMnemonic return true', function() {
    expect(paymentModel.checkMnemonic(mnemonic, password)).to.be.true
  })

  it('checkMnemonic return false', function() {
    expect(paymentModel.checkMnemonic(mnemonic, password+'0')).to.be.false
  })

  it('setMnemonic not throw error', function() {
    var fn = function() { paymentModel.setMnemonic(mnemonic, password) }
    expect(fn).to.not.throw(Error)
  })

  it('setMnemonic throw error', function() {
    paymentModel.readOnly = true
    var fn = function() { paymentModel.setMnemonic(mnemonic, password) }
    expect(fn).to.throw(Error)
  })

  it('addRecipient not throw error', function() {
    var fn = function() { paymentModel.addRecipient('n2f687HTAW5R8pg6DRVHn5AS1a2hAK5WgW', '0.01') }
    expect(fn).to.not.throw(Error)
  })

  it('addRecipient throw error', function() {
    paymentModel.readOnly = true
    var fn = function() { paymentModel.addRecipient('n2f687HTAW5R8pg6DRVHn5AS1a2hAK5WgW', '0.01') }
    expect(fn).to.throw(Error)
  })

  it('send return txId', function(done) {
    paymentModel.addRecipient('n2f687HTAW5R8pg6DRVHn5AS1a2hAK5WgW', '0.001')
    paymentModel.setMnemonic(mnemonic, password)
    paymentModel.send(function(error, txId) {
      expect(error).to.be.null
      expect(txId).to.be.an('string')
      done()
    })
  })

  it('send throw error (payment already sent)', function() {
    paymentModel.readOnly = true
    expect(paymentModel.send).to.throw(Error)
  })

  it('send throw error (recipient is empty)', function() {
    expect(paymentModel.send).to.throw(Error)
  })

  it('send throw error (mnemonic not set)', function() {
    paymentModel.addRecipient('n2f687HTAW5R8pg6DRVHn5AS1a2hAK5WgW', '0.01')
    expect(paymentModel.send).to.throw(Error)
  })

  // Todo: check other status
  it('getStatus return fresh', function() {
    expect(paymentModel.getStatus()).to.equal('fresh')
  })
})
