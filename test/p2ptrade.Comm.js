var expect = require('chai').expect

var MessageIO = require('../src/p2ptrade').Comm.MessageIO
var CommBase = require('../src/p2ptrade').Comm.CommBase
var ThreadedComm = require('../src/p2ptrade').Comm.ThreadedComm
var ThreadedComm = require('../src/p2ptrade').Comm.ThreadedComm

var MESSAGES = JSON.parse('[{"content": {"A": {"color_spec": "obc:ca99e77717e7d79001d3b876272ab118133a69cc7cbd4bf89d523f1be5607095:0:277127", "value": 100}, "msgid": "2050de1a0bc6db0b", "B": {"color_spec": "", "value": 10000000}, "oid": "1fd1f7b6c9be0ae6"}, "timestamp": 1414688356, "serial": 100033, "id": "1fd1f7b6c9be0ae6"}, {"content": {"A": {"color_spec": "", "value": 4000000}, "msgid": "99e8245205e00778", "B": {"color_spec": "obc:ca99e77717e7d79001d3b876272ab118133a69cc7cbd4bf89d523f1be5607095:0:277127", "value": 40}, "oid": "dba9a94ec735428a"}, "timestamp": 1414688387, "serial": 100034, "id": "dba9a94ec735428a"}]')


/**
 * @class MockMessageIO
 */
function MockMessageIO(){
  this.reset()
}

MockMessageIO.prototype.reset = function(){
  this.poll_log = []
  this.poll_result = MESSAGES
  this.post_log = []
}

MockMessageIO.prototype.poll = function(url, cb){
  this.poll_log.push(url)
  cb(null, this.poll_result)
}

MockMessageIO.prototype.post = function(url, content, cb){
  this.post_log.push({url:url, data:content})
  cb()
}


/**
 * @class MockAgent
 */
function MockAgent(){
  this.reset()
}

MockAgent.prototype.reset = function(){
  this.dispatch_log = []
}

MockAgent.prototype.dispatch_message = function(content){
  this.dispatch_log.push(content)
}


/**
 * Test P2PTrade Comm
 */
describe('P2PTrade Comm', function(){

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
   * Test BaseComm
   */
  describe('BaseComm', function(){

    it('add agent', function(){
      comm = new CommBase()
      comm.addAgent("a")
      expect(comm.agents).to.deep.equal(["a"])
      comm.addAgent("b")
      expect(comm.agents).to.deep.equal(["a", "b"])
    })

  })

  /**
   * Test ThreadedComm
   */
  describe('ThreadedComm', function(){
    
    var url, comm, msgio, agent

    beforeEach(function() {
      var config = { offer_expiry_interval : 1 }
      url = 'http://localhost:8080/messages'
      comm = new ThreadedComm(config, url)
      msgio = new MockMessageIO()
      agent = new MockAgent()
      comm.addAgent(agent)
      comm.msgio = msgio
      comm.start()
    })

    afterEach(function(){
      comm.stop()
    })

    it('post message content', function(done){
      var content = {test:"TEST"}
      comm.post_message(content)
      setTimeout(function(){
        var posted = msgio.post_log[0]
        content['msgid'] = posted['data']['msgid']
        expect(content).to.deep.equal(posted['data'])
        done()
      }, comm.sleep_time * 1.5)
    })

    it('post massage saves msgid', function(done){
      comm.post_message({})
      setTimeout(function(){
        var posted = msgio.post_log[0]
        expect(comm.own_msgids.contains(posted['data']['msgid'])).to.be.true
        done()
      }, comm.sleep_time * 1.5)
    })

    it('post message url', function(done){
      comm.post_message({})
      setTimeout(function(){
        var posted = msgio.post_log[0]
        expect(url).to.deep.equal(posted['url'])
        done()
      }, comm.sleep_time * 1.5)
    })

    it('post massage sets msgid', function(done){
      comm.post_message({})
      setTimeout(function(){
        var posted = msgio.post_log[0]
        expect('msgid' in posted['data']).to.be.true
        done()
      }, comm.sleep_time * 1.5)
    })

    it('poll', function(done){
      setTimeout(function(){
        var expected = [MESSAGES[0]["content"], MESSAGES[1]["content"]]
        var messages = comm.poll()
        expect(messages).to.deep.equal(expected)
        done()
      }, comm.sleep_time * 1.5)
    })

    it('poll and dispatch', function(done){
      setTimeout(function(){
        comm.poll_and_dispatch()
        var expected = [MESSAGES[0]["content"], MESSAGES[1]["content"]]
        expect(agent.dispatch_log).to.deep.equal(expected)
        done()
      }, comm.sleep_time * 1.5)
    })

  })

})
