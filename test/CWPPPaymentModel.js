var expect = require('chai').expect

var BIP39 = require('bip39')
var cclib = require('coloredcoinjs-lib')

var WalletEngine = require('../src/WalletEngine')
var cwpp = require('../src/cwpp')
var CWPPPaymentModel = require('../src/CWPPPaymentModel')
var errors = require('../src/errors')

describe('CWPPPaymentModel', function () {
  this.timeout(90 * 1000)

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

  before(function (done) {
    this.timeout(240 * 1000)

    global.localStorage.clear()
    walletEngine = new WalletEngine({
      testnet: true,
      blockchain: {name: 'Naive'},
      spendUnconfirmedCoins: true
    })
    walletEngine.once('syncStop', done)
    walletEngine.initialize(mnemonic, password, '')
    walletEngine.getWallet().addAssetDefinition(seed, goldAsset)
  })

  beforeEach(function (done) {
    var assetModel = walletEngine.getAssetModels().filter(function (am) {
      return am.getMoniker() === goldAsset.monikers[0]
    })[0]
    var paymentOpts = {
      cwpp_host: 'devel.hz.udoidio.info:4242',
      amount: '1',
      address: 'mr7NzJFwZ978iqmv3GaAWbCpYhaiLWf2JP'
    }
    assetModel.makePaymentRequest(paymentOpts).getPaymentURI(function (error, uri) {
      expect(error).to.be.null
      expect(cwpp.is_cwpp_uri(uri)).to.be.true

      paymentModel = new CWPPPaymentModel(walletEngine, uri)
      paymentModel.setSeed(seed)
      paymentModel.initialize(function (err) {
        try {
          expect(err).to.be.null
          done()
        } catch (err) {
          done(err)
        }
      })
    })
  })

  after(function () {
    walletEngine.getWallet().getConnector().disconnect()
    walletEngine.removeListeners()
    walletEngine = null
    global.localStorage.clear()
  })

  afterEach(function () {
    paymentModel = null
  })

  it('addRecipient throw NotImplementedError', function () {
    expect(paymentModel.addRecipient).to.throw(errors.NotImplementedError)
  })

  it('selectCoins', function (done) {
    paymentModel.selectCoins(function (err, cinputs, change, colordef) {
      try {
        expect(err).to.be.null
        expect(cinputs).to.be.an('array')
        cinputs.forEach(function (cinput) {
          expect(cinput.txId).to.match(/[0-9a-z]{64}/)
          expect(cinput.outIndex).to.be.a('number')
          expect(cinput.value).to.be.a('number')
          expect(cinput.script).to.match(/[0-9a-z]/)
        })
        expect(change).to.have.property('address').and.to.be.a('string')
        expect(change).to.have.property('value').and.to.be.a('number')
        expect(colordef).to.be.instanceof(cclib.definitions.Interface)

        done()
      } catch (err) {
        done(err)
      }
    })
  })

  it('send', function (done) {
    paymentModel.send(function (err) {
      try {
        console.log('CWPPPaymentModel.send err:', err && err.stack || err)
        expect(err).to.be.null
        done()
      } catch (err) {
        done(err)
      }
    })
  })
})
