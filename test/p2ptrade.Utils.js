var expect = require('chai').expect
var sinon = require('sinon') // use sinon to test ajax, see http://sinonjs.org/
var Utils = require('../src/p2ptrade').Utils
var unixTime = Utils.unixTime
var dictValues = Utils.dictValues
var make_random_id = Utils.make_random_id
var validator = require('validator')

/**
 * Test P2PTrade utils
 */
describe('P2PTrade utils', function(){

  /**
   * Test make_random_id
   */
  describe('make_random_id', function(){

    it('is random', function(){
      expect(make_random_id() == make_random_id()).to.be.false
    })

    it('at least 8 bytes of entropy', function(){
      expect(make_random_id().length >= 16).to.be.true
    })

    it('is hex str', function(){
      expect(validator.isHexadecimal(make_random_id())).to.be.true
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


