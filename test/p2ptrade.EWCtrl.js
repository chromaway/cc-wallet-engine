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

  })

})

