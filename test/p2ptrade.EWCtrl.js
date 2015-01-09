var expect = require('chai').expect
var EWalletController = require('../src/p2ptrade').EWCtrl.EWalletController
var WalletCore = require('cc-wallet-core');
var BIP39 = require('bip39')
var ccWallet = WalletCore.Wallet
var RawTx = WalletCore.tx.RawTx
var ColorValue = WalletCore.cclib.ColorValue;
var UncoloredColorDefinition = WalletCore.cclib.UncoloredColorDefinition

// mainnet, 3 uncolored outputs
var btcHexTx = require('./fixtures/p2ptrade.EWCtrl.json').tx.mainnet.uncolored3
var mnemonic = require('./fixtures/p2ptrade.EWCtrl.json').wallet.mnemonic
var password = require('./fixtures/p2ptrade.EWCtrl.json').wallet.password
var assetdefs = require('./fixtures/p2ptrade.EWCtrl.json').assetDefinitions

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

    it('get_targets', function(){
      // TODO test it
      expect(false).to.be.true
    })

    it('getChangeAddress', function(){
      // TODO test it
      expect(false).to.be.true
    })

    it('set_our_value_limit', function(){
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

      // mock wallet
      mockwallet = new MockWallet()
      mw_ewctrl = new EWalletController(mockwallet, "mock_seed_hex")

      // testnet wallet
      localStorage.clear()
      seed = BIP39.mnemonicToSeedHex(mnemonic, password)
      wallet = new ccWallet({
        testnet: true,
        blockchain: 'NaiveBlockchain',
        storageSaveTimeout: 0,
        spendUnconfirmedCoins: true,
        systemAssetDefinitions: assetdefs
      })
      wallet.initialize(seed)
      wallet.network.on('connect', done)
      ewctrl = new EWalletController(wallet, seed)
    })

    afterEach(function () {
      wallet.removeListeners()
      wallet.clearStorage()
      wallet = undefined
    })

    it('publish_tx', function(){
      var my_offer = null
      var rawTx = RawTx.fromHex(btcHexTx)
      mw_ewctrl.publish_tx(rawTx, my_offer)
      expect(mockwallet.txSent.length).to.deep.equal(1)
    })

    it.skip('check_tx', function(){
      // TODO test it
    })

    it('resolve_color_spec', function(){
      var desc = ewctrl.resolve_color_spec(gold['colorDescs'][0])
      expect(desc.getColorId() > 0).to.be.true
      expect(desc.getDesc()).to.deep.equal(gold['colorDescs'][0])
    })

    it.skip('offer_side_to_colorvalue', function(){
      // TODO test it
      // function is dead code?
    })

    it('has sufficient balance for selectInputs test', function(done){
      var assetdef = wallet.getAssetDefinitionByMoniker('bitcoin')
      wallet.getBalance(assetdef, function (error, balance) {
        expect(error).to.be.null
        expect(balance.total > 0.001).to.be.true
        done()
      })
    })

    it('selectInputs', function(done){
      var colorValue = new ColorValue(new UncoloredColorDefinition(), 0.001)
      ewctrl.selectInputs(colorValue, function(err, selection, change){
        expect(error).to.be.null
        // TODO check if selection - change = colorValue
        done()
      })
    })

    it.skip('make_etx_spec', function(){
      // TODO test it
    })

    it.skip('make_reply_tx', function(){
      // TODO test it
    })

    it('getSeedHex', function(){
      expect(mw_ewctrl.getSeedHex()).to.deep.equal("mock_seed_hex")
    })

  })

})

