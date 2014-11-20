var expect = require('chai').expect
var EWalletController = require('../src/p2ptrade').EWCtrl.EWalletController


/**
 * @class MockWalletModel
 */
function MockWalletModel(){
  // TODO implement
  this.ccc = undefined
  this.tx_history = undefined
}

MockWalletModel.prototype.get_color_map = function(){
  return [] // TODO implement
}

MockWalletModel.prototype.get_address_manager = function(){
  return undefined // TODO implement
}

MockWalletModel.prototype.transform_tx_spec = function(op_tx_spec, TODOstr){
  return undefined // TODO implement
}


/**
 * @class MockWalletController
 */
function MockWalletController(){
  this.published = []
}

MockWalletController.prototype.publish_tx = function(raw_tx){
  this.published.push(raw_tx)
}


/**
 * Test P2PTrade EWCtrl
 */
describe('P2PTrade EWCtrl', function(){

  /**
   * Test EWalletController
   */
  describe('EWalletController', function(){

    var ewctrl

    beforeEach(function() {
      ewctrl = EWalletController(MockWalletModel(), MockWalletController())
    }

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

