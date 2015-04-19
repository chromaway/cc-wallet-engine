var expect = require('chai').expect
var Utils = require('../src/p2ptrade').Utils
var unixTime = Utils.unixTime
var dictValues = Utils.dictValues
var makeRandomId = Utils.makeRandomId
var validator = require('validator')

/**
 * Test P2PTrade utils
 */
describe('P2PTrade utils', function(){

  /**
   * Test makeRandomId
   */
  describe('makeRandomId', function(){

    it('is random', function(){
      expect(makeRandomId() == makeRandomId()).to.be.false
    })

    it('at least 8 bytes of entropy', function(){
      expect(makeRandomId().length >= 16).to.be.true
    })

    it('is hex str', function(){
      expect(validator.isHexadecimal(makeRandomId())).to.be.true
    })

  })

  /**
   * Test dictValues
   */
  describe('dictionary', function(){

    it('dictValues', function(){
      var expected = [1,2,3]
      var result = dictValues({a:1,b:2,c:3})
      expect(result.sort()).to.deep.equal(expected.sort())
    })

  })

  /**
   * Test unixTime
   */
  describe('unixTime', function(){

    it('has correct type', function(){
      expect(typeof(unixTime())).to.deep.equal("number")
    })

    it('no time traveling', function(){
      expect(unixTime() > 1400000000.0).to.be.true
    })
  })

})


