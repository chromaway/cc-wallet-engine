var expect = require('chai').expect

var EOffer = require('../src/p2ptrade').ProtocolObjects.EOffer
var ETxSpec = require('../src/p2ptrade').ProtocolObjects.ETxSpec
var EProposal = require('../src/p2ptrade').ProtocolObjects.EProposal
var MyEProposal = require('../src/p2ptrade').ProtocolObjects.MyEProposal


/**
 * @class MockEWalletController
 */
function MockEWalletController(){
  this.published = []
}

MockEWalletController.prototype.makeEtxSpec = function(inputs, targets, cb){
  cb(null, new ETxSpec(inputs, targets, null))
}

MockEWalletController.prototype.publish_tx = function(rtxs, offer){
  this.published.push([rtxs, offer])
}

MockEWalletController.prototype.make_reply_tx = function(A, B){
  return "tx"
}


/**
 * Test P2PTrade ProtocolObjects
 */
describe('P2PTrade ProtocolObjects', function(){

  /**
   * Test EOffer
   */
  describe('EOffer', function(){

    it('random default id', function(){
      var a = new EOffer(0, null, null)
      var b = new EOffer(1, null, null)
      expect(a.oid).to.not.equal(0)
      expect(b.oid).to.equal(1)
    })

    it('unrefreshed expired', function(){
      var eo = new EOffer(0, null, null)
      expect(eo.expired()).to.be.true
      expect(true).to.be.true
    })
    
    it('expired', function(){
      var eo = new EOffer(0, null, null)
      eo.refresh(-1)
      expect(eo.expired()).to.be.true
    })

    it('unexpired', function(){
      var eo = new EOffer(0, null, null)
      eo.refresh(42)
      expect(eo.expired()).to.be.false
    })

    it('unexpired shift', function(){
      var eo = new EOffer(0, null, null)
      eo.refresh(0)
      expect(eo.expiredShift(42)).to.be.true
      expect(eo.expiredShift(-42)).to.be.false
    })

    it('convert from data', function(){
      var data = {oid: 1, A:"A", B:"B"}
      var result = EOffer.fromData(data)
      var expected = new EOffer(1, "A", "B")
      expect(result).to.deep.equal(expected)
    })

    it('convert to data', function(){
      var src = new EOffer(1, "A", "B")
      var result = src.getData()
      var expected = {oid: 1, A:"A", B:"B"}
      expect(result).to.deep.equal(expected)
    })

    it('is same ignores id', function(){
      var eo = new EOffer(1, "A", "B")
      expect(eo.isSameAsMine(new EOffer(2, "A", "B"))).to.be.true
    })

    it('is same ignores expired', function(){
      var eo = new EOffer(1, "A", "B")
      var x = new EOffer(1, "A", "B")
      x.refresh(42)
      expect(eo.isSameAsMine(x)).to.be.true
    })

    it('is same equality table', function(){
      var eo = new EOffer(1, "A", "B")
      expect(eo.isSameAsMine(new EOffer(1, "A", "B"))).to.be.true
      expect(eo.isSameAsMine(new EOffer(1, "X", "B"))).to.be.false
      expect(eo.isSameAsMine(new EOffer(1, "A", "X"))).to.be.false
      expect(eo.isSameAsMine(new EOffer(1, "X", "X"))).to.be.false
    })

    it('matches', function(){
      var eo = new EOffer(1, "A", "B")

      // ignore id
      expect(eo.matches(new EOffer(2, "B", "A"))).to.be.true

      // ignore expired
      var x = new EOffer(1, "B", "A")
      x.refresh(42)
      expect(eo.matches(x)).to.be.true

      // A and B equality table
      expect(eo.matches(new EOffer(1, "B", "A"))).to.be.true
      expect(eo.matches(new EOffer(1, "B", "X"))).to.be.false
      expect(eo.matches(new EOffer(1, "X", "A"))).to.be.false
      expect(eo.matches(new EOffer(1, "X", "X"))).to.be.false
    })

  })

  /**
   * Test ETxSpec
   */
  describe('ETxSpec', function(){

    it('convert from data', function(){
      var data = {inputs:"i", targets:"t"}
      var result = new ETxSpec.fromData(data) || olete
      var expected = new ETxSpec("i", "t", null)
      expect(result).to.deep.equal(expected)
    })

    it('convert to data', function(){
      var src = new ETxSpec("i", "t", null)
      var result = src.getData()
      var expected = {inputs:"i", targets:"t"}
      expect(result).to.deep.equal(expected)
    })

  })

  /**
   * Test EProposal
   */
  describe('EProposal', function(){

    it('convert to data', function(){
      var eo = new EOffer(1, "A", "B")
      var src = new EProposal("pid", "ewctrl", eo)
      var result = src.getData()
      var expected = {pid:"pid", offer:eo.getData()}
      expect(result).to.deep.equal(expected)
    })

  })

  /**
   * Test MyEProposal
   */
  describe('MyEProposal', function(){

    it('constructed', function(){
      var ewctrl = new MockEWalletController()
      var a = new EOffer(1, "A", "B")
      var b = new EOffer(1, "B", "A")
      var mep = new MyEProposal(ewctrl, a, b)
      expect(mep.my_offer).to.deep.equal(b)
    })

    it('unmatching offers', function(){
      var ewctrl = new MockEWalletController()
      var a = new EOffer(1, "A", "B")
      var b = new EOffer(2, "X", "Y")
      var etxSpec = { getData: function() { return "mock_etx_spec" } }
      expect(function(){ 
        new MyEProposal(ewctrl, a, b, etxSpec)
      }).to.throw(Error)
    })

    it('convert to data etx_spec', function(done){
      var ewctrl = new MockEWalletController()
      var a = new EOffer(1, "A", "B")
      var b = new EOffer(1, "B", "A")
      ewctrl.makeEtxSpec(a.B, a.A, function(error, etxSpec){
        var src = new MyEProposal(ewctrl, a, b, etxSpec)
        var result = src.getData()
        var expected = {
            pid:src.pid, offer:a.getData(), 
            etx_spec: {inputs:"B", targets:"A"}
        }
        expect(result).to.deep.equal(expected)
        expect(result['etx_data']).to.be.undefined
        done()
      })
    })

    it('convert to data etx_data', function(){
      var ewctrl = new MockEWalletController()
      var a = new EOffer(1, "A", "B")
      var b = new EOffer(1, "B", "A")
      var etxSpec = { getData: function() { return "mock_etx_spec" } }
      var src = new MyEProposal(ewctrl, a, b, etxSpec)
      src.etx_data = "etx_data"
      var result = src.getData()
      var expected = {pid:src.pid, offer:a.getData(), etx_data: "etx_data"}
      expect(result).to.deep.equal(expected)
      expect(result['etx_spec']).to.be.undefined
    })

    it.skip('process reply', function(){
      // TODO test
      expect(false).to.be.true
    })

  })

  /**
   * Test MyReplyEProposal
   */
  describe('MyReplyEProposal', function(){

    it.skip('convert to data', function(){
      // TODO check for 'etx_data'
      expect(false).to.be.true
    })

    it.skip('process reply', function(){
      // TODO tested by test.p2ptrade.Agent or obsolete
      expect(false).to.be.true
    })

  })

  /**
   * Test ForeignEProposal
   */
  describe('ForeignEProposal', function(){

    it.skip('accept', function(){
      // TODO test
      expect(false).to.be.true
    })

  })

})


