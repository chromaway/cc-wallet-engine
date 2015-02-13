var expect = require('chai').expect

var BIP39 = require('bip39')
var cccore = require('cc-wallet-core')

var WalletEngine = require('../src/WalletEngine')
var cwpp = require('../src/cwpp')
var CWPPPaymentModel = require('../src/CWPPPaymentModel')
var errors = require('../src/errors')


describe('CWPPPaymentModel', function () {
  var mnemonic = 'good fog frozen vote rate law scrap little tuition page olympic wagon'
  var password = ''
  var seed = BIP39.mnemonicToSeedHex(mnemonic, password)
  var goldAsset = {
    monikers: ['gold'],
    colorDescs: ['epobc:a56e072d1315aacf157fd114831837e059eaea3cf49406ee5e8107be0c2f195e:0:316683'],
    unit: 10000
  }

  var walletEngine
  var paymentModel

  beforeEach(function (done) {
    localStorage.clear()
    walletEngine = new WalletEngine({
      testnet: true,
      networks: [{name: 'ElectrumJS', args: [{testnet: true}]}],
      blockchain: {name: 'Naive'},
      spendUnconfirmedCoins: true
    })
    walletEngine.once('syncStop', function () {
      var assetModel = walletEngine.getAssetModels().filter(function (am) {
        return am.getMoniker() === goldAsset.monikers[0]
      })[0]
      var paymentOpts = {
        // cwpp_host: 'localhost:4242',
        amount: '1',
        address: 'mr7NzJFwZ978iqmv3GaAWbCpYhaiLWf2JP'
      }
      assetModel.makePaymentRequest(paymentOpts).getPaymentURI(function (error, uri) {
        expect(error).to.be.null
        expect(cwpp.is_cwpp_uri(uri)).to.be.true

        paymentModel = new CWPPPaymentModel(walletEngine, uri)
        paymentModel.setSeed(seed)
        paymentModel.initialize(function (error) {
          expect(error).to.be.null
          done()
        })
      })
    })
    walletEngine.initialize(mnemonic, password, '')
    walletEngine.getWallet().addAssetDefinition(seed, goldAsset)
  })

  afterEach(function () {
    paymentModel = null
    walletEngine.getWallet().getNetwork().disconnect()
    walletEngine.removeListeners()
    walletEngine.clearStorage()
    walletEngine = null
  })

  it('addRecipient throw NotImplementedError', function () {
    expect(paymentModel.addRecipient).to.throw(errors.NotImplementedError)
  })

  it('selectCoins', function (done) {
    paymentModel.selectCoins(function (error, cinputs, change, colordef) {
      expect(error).to.be.null
      expect(cinputs).to.be.an('array')
      cinputs.forEach(function (cinput) {
        cccore.verify.txId(cinput.txId)
        cccore.verify.number(cinput.outIndex)
        cccore.verify.number(cinput.value)
        cccore.verify.hexString(cinput.script)
      })
      expect(change).to.have.property('address').and.to.be.a('string')
      expect(change).to.have.property('value').and.to.be.a('number')
      expect(colordef).to.be.instanceof(cccore.cclib.ColorDefinition)
      done()
    })
  })

  it('send', function (done) {
    paymentModel.send(function (error) {
      expect(error).to.be.null
      done()
    })
  })
})
