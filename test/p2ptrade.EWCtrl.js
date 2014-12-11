var expect = require('chai').expect
var EWalletController = require('../src/p2ptrade').EWCtrl.EWalletController


/**
 * @class MockWalletModel
 */
function MockWallet(){
  // TODO implement
}



/**
 * Test P2PTrade EWCtrl
 */
describe('P2PTrade EWCtrl', function(){

  /**
   * Test OperationalETxSpec
   */
  describe('OperationalETxSpec', function(){

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

    var ewctrl, wallet

    beforeEach(function() {
      wallet = MockWallet()
      ewctrl = EWalletController(wallet)
    })

    it('publish_tx', function(){
      // TODO test it
    })

    it('check_tx', function(){
      // TODO test it
    })

    it('resolve_color_spec', function(){
      // TODO test it
    })

    it('offer_side_to_colorvalue', function(){
      // TODO test it
    })

    it('select_inputs', function(){
      // TODO test it
    })

    it('make_etx_spec', function(){
      // TODO test it
    })

    it('make_reply_tx', function(){
      // TODO test it
    })

    it('getSeedHex', function(){
      // TODO test it
    })

  })

})

