var expect = require('chai').expect
var sinon = require('sinon') // use sinon to test ajax, see http://sinonjs.org/
var unixTime = require('../src/p2ptrade').Utils.unixTime
var dictValues = require('../src/p2ptrade').Utils.dictValues


/**
 * Test P2PTrade utils
 */
describe('P2PTrade utils', function(){

  /**
   * Test make_random_id
   */
  describe('make_random_id', function(){

    it('is random', function(){
      // TODO test it
      expect(false).to.be.true
    })

    it('8 bytes of entropy', function(){
      // TODO test it
      expect(false).to.be.true
    })

    it('is hex str', function(){
      // TODO test it
      expect(false).to.be.true
    })

  })

  /**
   * Test HTTPInterface
   */
  describe('HTTPInterface', function(){

    it('poll', function(){
      // TODO test it
      expect(false).to.be.true
    })

    it('post', function(){
      // TODO test it
      expect(false).to.be.true
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


