var expect = require('chai').expect
var async = require('async')
var EWalletController = require('../src/p2ptrade').EWCtrl.EWalletController
var ETxSpec = require('../src/p2ptrade').ProtocolObjects.ETxSpec
var ccCore = require('cc-wallet-core');
var BIP39 = require('bip39')
var ccWallet = ccCore.Wallet
var RawTx = ccCore.tx.RawTx
var Coin = ccCore.coin.Coin
var ColorValue = ccCore.cclib.ColorValue;
var UncoloredColorDefinition = ccCore.cclib.UncoloredColorDefinition
var Transaction = ccCore.cclib.bitcoin.Transaction

// fixtures
var fixtures = require('./fixtures/p2ptrade.EWCtrl.json')
var btcHexTx = fixtures.tx.uncolored2.raw // mainnet, 2 uncolored outputs
var mnemonic = fixtures.wallet.alice.mnemonic
var password = fixtures.wallet.alice.password
var assetdefs = fixtures.assetDefinitions
var gold = assetdefs[0]

/**
 * @class MockWalletModel
 */
function MockWallet(){
  this.txSent = []
}

MockWallet.prototype.sendTx = function(tx, cb){
  this.txSent.push(tx)
  cb()
}

/**
 * Test P2PTrade EWCtrl
 */
describe('P2PTrade EWCtrl', function(){

  /**
   * Test OperationalETxSpec
   */
  describe.skip('OperationalETxSpec', function(){

    it('getChangeAddress', function(){
      // TODO test it
      expect(false).to.be.true
    })

    it('setOurValueLimit', function(){
      // TODO test it
      expect(false).to.be.true
    })

    it('prepare_inputs', function(){
      // TODO test it
      expect(false).to.be.true
    })

    it('prepare_targets', function(){
      // TODO test it
      expect(false).to.be.true
    })

    it('select_uncolored_coins', function(){
      // TODO test it
      expect(false).to.be.true
    })

    it('select_coins', function(){
      // TODO test it
      expect(false).to.be.true
    })

  })

  /**
   * Test EWalletController
   */
  describe('EWalletController', function(){

    var mockwallet
    var mw_ewctrl
    var seed
    var wallet
    var ewctrl

    beforeEach(function(done) {

      // mock wallet/ewctrl
      mockwallet = new MockWallet()
      mw_ewctrl = new EWalletController(mockwallet, "mock_seed_hex")

      // testnet wallet/ewctrl
      localStorage.clear()
      seed = BIP39.mnemonicToSeedHex(mnemonic, password)
      wallet = new ccWallet({
        testnet: true,
        storageSaveTimeout: 0,
        spendUnconfirmedCoins: true,
        systemAssetDefinitions: assetdefs
      })
      wallet.initialize(seed)
      wallet.once('syncStop', done)
      ewctrl = new EWalletController(wallet, seed)
    })

    afterEach(function () {
      wallet.removeListeners()
      wallet.clearStorage()
      wallet = undefined
    })

    it('publishTX', function(){
      var my_offer = null
      var rawTx = RawTx.fromHex(btcHexTx)
      mw_ewctrl.publishTX(rawTx, my_offer)
      expect(mockwallet.txSent.length).to.equal(1)
    })

    it.skip('check_tx', function(){
      // TODO test it
    })

    it('resolveColorDesc', function(){
      var desc = ewctrl.resolveColorDesc(gold['colorDescs'][0])
      expect(desc.getColorId() > 0).to.be.true
      expect(desc.getDesc()).to.deep.equal(gold['colorDescs'][0])
    })

    it('selectInputs uncolored', function(done){
      var colordef = new UncoloredColorDefinition()
      var expectedCV = new ColorValue(colordef, 0.001)
      ewctrl.selectInputs(expectedCV, function(error, inputs, change){
        if (error){ throw error }
        expect(error).to.be.null
        async.map(inputs, function(input, cb){
          expect(input).to.be.instanceof(Coin)
          cb(null, input)
        }, function(error, inputCVs){
          done()
        })
      })
    })

    it.skip('selectInputs uncolored check values', function(done){ // FIXME
      var colordef = new UncoloredColorDefinition()
      var expectedCV = new ColorValue(colordef, 0.001)
      ewctrl.selectInputs(expectedCV, function(error, inputs, change){
        if (error){ throw error }
        expect(error).to.be.null
        async.map(inputs, function(input, cb){
          expect(input).to.be.instanceof(Coin)
          // input coin seem to be correct but cant get ColorValue from it
          input.getColorValue(colordef, cb)
        }, function(error, inputCVs){
          if (error){ throw error }
          expect(error).to.be.null
          expect(ColorValue.sum(inputCVs).minus(change)).to.equal(expectedCV)
          done()
        })
      })
    })

    it('makeEtxSpec', function(done){
      var tradeValue = 100000 // 1mBTC
      var maxfee = 50000 // 0.5 mBTC
      var our = {"color_spec": "", "value": tradeValue}
      var their = {"color_spec": gold["colorDescs"][0], "value": tradeValue}
      ewctrl.makeEtxSpec(our, their, function(error, etxSpec){
        expect(error).to.be.null
        expect(etxSpec).to.be.instanceof(ETxSpec)

        // FIXME check inputs/change color and values
        done()
      })
    })

    it('makeReplyTx uncolored', function(done){
      var tradeValue = 100000 // 1mBTC
      var maxfee = 50000 // 0.5 mBTC
      var our = {"color_spec": "", "value": tradeValue}
      var their = {"color_spec": "", "value": tradeValue}
      ewctrl.makeEtxSpec(our, their, function(error, etxSpec){
        expect(error).to.be.null
        ewctrl.makeReplyTx(etxSpec, their, our, function(error, signedTx){
          expect(error).to.be.null
          expect(signedTx).to.be.instanceof(Transaction)
          var rawTx = RawTx.fromTransaction(signedTx)
          rawTx.getDeltaColorValues(wallet, function(error, colorValues){
            expect(colorValues).to.be.an('array').with.to.have.length(1)
            var colorValue = colorValues[0]
            expect(colorValue.isUncolored()).to.be.true
            expect(colorValue.getValue()).to.above(-maxfee)
            done()
          })
        })
      })
    })

    it('getSeedHex', function(){
      expect(mw_ewctrl.getSeedHex()).to.deep.equal("mock_seed_hex")
    })

  })

})

