var expect = require('chai').expect
var sinon = require('sinon') // use sinon to test ajax, see http://sinonjs.org/
var Utils = require('../src/p2ptrade').Utils
var unixTime = Utils.unixTime
var dictValues = Utils.dictValues
var MessageIO = Utils.MessageIO
var make_random_id = Utils.make_random_id
var validator = require('validator')
var request = require('request');

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
   * Test MessageIO
   */
  describe('MessageIO', function(){

    it('poll', function(done){
      var messageio = new MessageIO()
      var url = "http://p2ptrade.btx.udoidio.info/messages"
      messageio.poll(url, function(error, messages){
        try {
          if(error){
            throw error
          }
          messages.forEach(function(message){ 
            expect("id" in message).to.be.true
            expect("content" in message).to.be.true
          })
          done()
        } catch(e) {
          done(e)
        }
      })
    })

    it('post', function(done){
      var messageio = new MessageIO()
      var url = "http://p2ptrade.btx.udoidio.info/messages"
      var content = {
        content: {
          A: {
            color_spec: 'epobc:c64992e7284007b479b3d1c91b3c34d9c65dc015e92b0f6ed396adc211b8c020:0:308509',
            value: 20000
          },
          B: {
            color_spec: '', 
            value: 40000000
          },
          msgid: '4a039876cc31b594',
          oid: '942424628de5d631'
        },
        id: '942424628de5d631',
        serial: 100731,
        timestamp: 1416070040
      }
      messageio.post(url, content, function(error){
        if(error){
          done(error)
        } else {
          done()
        }
      })
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


