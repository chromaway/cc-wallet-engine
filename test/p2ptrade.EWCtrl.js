var expect = require('chai').expect
var EWalletController = require('../src/p2ptrade').EWCtrl.EWalletController
var WalletCore = require('cc-wallet-core');
var BIP39 = require('bip39')
var ccWallet = WalletCore.Wallet
var RawTx = WalletCore.tx.RawTx
var ColorValue = WalletCore.cclib.ColorValue;
var UncoloredColorDefinition = WalletCore.cclib.UncoloredColorDefinition

var mnemonic = "glory patient hour tilt hill cricket farm heavy spice raw culture height"
var password = "12345678"
var gold = {
    monikers: ['gold'],
    colorDescs: ['epobc:b95323a763fa507110a89ab857af8e949810cf1e67e91104cd64222a04ccd0bb:0:180679']
}
var euro = {
    "colorDescs": ["epobc:0261b29b587020eeca15f831a5290a9d81038851da4365689be04e588ce58c66:0:303510"],
    "monikers": ["euro"],
    "unit": 100
}

// mainnet, 3 uncolored outputs
var btcHexTx = "010000000db1df616729572e390d1c969671cb295db910d8309c663c5af6ad37a4d8b712a1030000006a47304402207117d0ec9b371ff80b55a20b596fedd55b4ed32c21932eca73060e1d3c173c3e0220414b562003e1c564fd05ac7f439f0fc4e1ab9e795895b6e489dc48dc76548b040121036396b800ce4dcf8ca946574a46522344d7c8903fd0c0bac97e808dcb84171aa0ffffffff598a541726e8e3a0933ca017a433ff67fdbd25f0c93aa1b63445d52b5bf6fe4f010000006b4830450221008aee593f7cb7d26a9260770a9ab4df3c904fa00c0d4df102591567b7b6bac428022078944bd7ab7a4341d0c8bea8485061514c53afb7b303826fd5d72f6890c65d9e01210399e4b54288da745e99ebcd2419a5ab190c256e4bf6c8c693156b29493b9d956bffffffff0ffba10da771bcbf5dbc4f17566298bb88272e96d7b22329acfeeefbf52e6642000000006b483045022100ce18b8e5353d866ba86bf70da21709dafe629e6002c130151d18062788732a280220469e646784dab3ace0b808dbc3dc9a32212d4329ad1fac210337b8800914a465012102129520fd3073b6a98a04821e534157b278e635ed6306a48541972e5d01e5b911ffffffffd73de70507b6c0efa2b78c56744ad8c8ee6ab19a0f1cca9953d30f2a4ca17a82020000006b48304502210090499c7f56bfa793fce45dc1a97800573ba80c722d344a92038d7fbd09c67bdf02202b5958a453a81f741dc7c2e41e064c00c48258b68337f445fcc9f7cff89ed8b4012103d1a9447f378426ff88cdeaf58051834c03fa007de41a350402ba1a6b2277eb88ffffffffedc16eb9ee50390b47726e0ac2fd05ddb06291cb681f7bcb9c9aee20267198c5840000006b483045022100f47195c1f00d726bc936efdda347fbe83f61fe99f716e930830bb1d921bb1320022023e9178b5b31b9b6f73086c7d7adff98af629c79e639bbabbb5f8075c97080b2012102f519f4e12190f78b2955255cbbc3c2f5f97033b359452a8f1985b20092aef193ffffffffb07cc6cecb2e3ef34615c6425b84b8bca23197283cacbc887900fbe9e3620775010000006a473044022057176e710022df7ebdec2ef3b9ccdd5f813bad880d4b98e26ba32d5effe39a7d02206e0cf11435c59ebf5e9a0bb972e925d55787d2ba3967b4d32dba1ec008555843012102e78d4b22695a966b4f2ba27a605d3f4b85789dff1aff522ffcb3da42541b3ebdffffffffe76986d215bb370d8f4ad95b704a2293b6965efc948b269de1c69bb5e4e082bc030000006a473044022061cdec9fbee33b9afe2c0420aee2618a1eb1c939e263634de29d8070d051f435022010c204a707fe248b5904ef177e9f9ccef80b54c689930952e3ecff589721754c012102749baaca7d26da12d631fc068860488d3486a4ffca66ab9b64273ede6d9659afffffffff810df66f92c51a397697d5759fa7208676e445ecd0641e4aa74b6e3e2da0b82c220000006a473044022079887380c5cca386e2c7f37965d82650ddb2629d3bc2b7a80aa94b59e45614bf02207a8ede23280fc22775dd7a2e4653702056d3f594a8ed41d5fabd79ba13b0ae1b0121036112fa2376580f2b23bc98ec0b048a12e6d13158c666bbd1f950965f0b860c7bffffffff810df66f92c51a397697d5759fa7208676e445ecd0641e4aa74b6e3e2da0b82c090100006a4730440220241fd79ab78f0bc508c0bbad4c40abe0ecf39d58bcfd26cf29c3303df5e2df1702205fe51f46318a475cb3a5da71a8b65e159ecc0e24a3cb1de3a16ba89b2189269c012102297beac81360088d4bbf41c2070a2cd911a139c2813731f3f294352c25e2772effffffff810df66f92c51a397697d5759fa7208676e445ecd0641e4aa74b6e3e2da0b82c220100006a47304402205865172dfdb6164342c0e8956fd10f8f561dc1ef54837c73e172b0a71e2421cc02203fb1e2b7c85c684a55174012af482f59b0465554404cca807b75d83f8b46fddd012103f71d0d62403d9b31f4a826214ab2f7176d36ea61c16922b12822ec862105891dffffffff54d6554bb8d25b27ee6dee2de83b663f5c24d463a21467a6f72b66fac257b1e5010000006b483045022100b4f1ecee11d36d9177216144e541fc5b9f8372ec2c3b8f9bb664d9403b416c4c0220303f56c15db45f887cee9dd9bd8214f6c6c8444c7fa304f2d75b8d496fcf576b01210344e15f28d36d8aa163d590c1cd1ac3ba9ee0247bc910966cc305faccb749398effffffff54d6554bb8d25b27ee6dee2de83b663f5c24d463a21467a6f72b66fac257b1e51c0000006b483045022100c21ccc0a152ebf7212ccde26d395c87678ffc00408d20f10d87eb38938418580022012856d3dbcd369d48959a8474fdfd75d7c59f65bfb9d781af0f8800b014e96f80121024c7896099f802daebc090312a3d024ba8bf7668cc2613d51d0549c52e8ebef51ffffffff20f3263ad8429424cea672ccd166f0ab82848218ea06acc63178bc15467e5e7f040000006b483045022100d7c6eed4459047da07c46e93bf7724b9296cacf79498987ed4f3c2e0578097df02206a50882c808bd2ddb84cc2bcf45bdfee096d27b3f524464ad2fe24bad5ab7b65012103f2f31f00fb7f228d5ad0567a9fc953befb273da5b8226619550b78c04901d647ffffffff03c09ee605000000001976a9149f599b0df297f29176f824867c2055caf9960dcf88ac008e0c01000000001976a914d964c6fda9742d1624ddb0483447de4e481f6d9988ace7430f00000000001976a914f5c57aac9a7f9838ba0ee8d7efbe8eab38dd092088ac00000000"

/**
 * @class MockWalletModel
 */
function MockWallet(){
  // TODO implement
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

    beforeEach(function() {
      // mock wallet
      mockwallet = new MockWallet()
      mw_ewctrl = new EWalletController(mockwallet, "mock_seed_hex")

      // testnet wallet
      seed = BIP39.mnemonicToSeedHex(mnemonic, password)
      var systemAssetDefinitions = [euro, gold]
      wallet = new ccWallet({
        testnet: true,
        systemAssetDefinitions: systemAssetDefinitions
      })
      wallet.initialize(seed)
      ewctrl = new EWalletController(wallet, seed)
    })

    afterEach(function () {
      wallet.clearStorage()
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
      // may be dead code
    })

    it('selectInputs', function(){
      var colorValue = new ColorValue(new UncoloredColorDefinition(), 0.0001)

      /*
      var assetdef = wallet.getAssetDefinitionByMoniker('bitcoin')
      wallet.getAllAddresses(assetdef, false) // n3Ts2wz9DXKTVBoc46dnQ1S8NzqWZebiBW
      */

      /*
      var assetdef = wallet.getAssetDefinitionByMoniker('bitcoin')
      wallet.getBalance(assetdef, function (err, balance) {
        throw new Error(balance.total + " " + balance.available + " " + balance.unconfirmed)
      })
      */


      ewctrl.selectInputs(colorValue, function(err, selection, change){
        if(err){
          throw new Error(err)
        }
        //expect(!err).to.be.true
        //selection.uitderniutaegn()
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

