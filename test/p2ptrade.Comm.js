var expect = require('chai').expect

var CommBase = require('../src/p2ptrade').Comm.CommBase
var HTTPComm = require('../src/p2ptrade').Comm.HTTPComm
var ThreadedComm = require('../src/p2ptrade').Comm.ThreadedComm

var MESSAGES = JSON.parse('[{"content": {"A": {"color_spec": "obc:ca99e77717e7d79001d3b876272ab118133a69cc7cbd4bf89d523f1be5607095:0:277127", "value": 100}, "msgid": "2050de1a0bc6db0b", "B": {"color_spec": "", "value": 10000000}, "oid": "1fd1f7b6c9be0ae6"}, "timestamp": 1414688356, "serial": 100033, "id": "1fd1f7b6c9be0ae6"}, {"content": {"A": {"color_spec": "", "value": 4000000}, "msgid": "99e8245205e00778", "B": {"color_spec": "obc:ca99e77717e7d79001d3b876272ab118133a69cc7cbd4bf89d523f1be5607095:0:277127", "value": 40}, "oid": "dba9a94ec735428a"}, "timestamp": 1414688387, "serial": 100034, "id": "dba9a94ec735428a"}]')


/**
 * @class MockHTTPInterface
 */
function MockHTTPInterface(){
  this.reset()
}

MockHTTPInterface.prototype.reset = function(){
  this.poll_log = []
  this.poll_result = MESSAGES
  this.post_log = []
  this.post_returncode = true
}

MockHTTPInterface.prototype.poll = function(url){
  this.poll_log.push(url)
  return this.poll_result
}

MockHTTPInterface.prototype.post = function(url, data){
  this.post_log.push({url:url, data:data})
  return this.post_returncode
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
   * Test BaseComm
   */
  describe('BaseComm', function(){

    it('add agent', function(){
      comm = new CommBase()
      comm.add_agent("a")
      expect(comm.agents).to.deep.equal(["a"])
      comm.add_agent("b")
      expect(comm.agents).to.deep.equal(["a", "b"])
    })

  })

  /**
   * Test HTTPComm
   */
  describe('HTTPComm', function(){
    
    var url, comm, http_interface, agent

    beforeEach(function() {
      var config = { offer_expiry_interval : 1 }
      url = 'http://localhost:8080/messages'
      comm = new HTTPComm(config, url)
      http_interface = new MockHTTPInterface()
      comm.http_interface = http_interface
      agent = new MockAgent()
      comm.add_agent(agent)
    })

    it('post message content', function(){
      // http_interface.reset()
      var content = {test:"TEST"}
      comm.post_message(content)
      var posted = http_interface.post_log[0]
      content['msgid'] = posted['data']['msgid']
      expect(content).to.deep.equal(posted['data'])
    })

    it('post massage saves msgid', function(){
      // http_interface.reset()
      comm.post_message({})
      var posted = http_interface.post_log[0]
      expect(comm.own_msgids.contains(posted['data']['msgid'])).to.be.true
    })

    it('post message url', function(){
      // http_interface.reset()
      comm.post_message({})
      var posted = http_interface.post_log[0]
      expect(url).to.deep.equal(posted['url'])
    })

    it('post massage sets msgid', function(){
      // http_interface.reset()
      comm.post_message({})
      var posted = http_interface.post_log[0]
      expect('msgid' in posted['data']).to.be.true
    })

    it('post message returncode', function(){
      // http_interface.reset()
      http_interface.post_returncode = false
      expect(comm.post_message({})).to.be.false
      http_interface.post_returncode = true
      expect(comm.post_message({})).to.be.true
    })

    it('poll and dispatch', function(){
      // http_interface.reset()
      comm.poll_and_dispatch()
      var expected = [MESSAGES[0]["content"], MESSAGES[1]["content"]]
      expect(agent.dispatch_log).to.deep.equal(expected)
    })

  })

  /**
   * Test ThreadedComm
   * TODO how to thread in js?
   */
  describe.skip('ThreadedComm', function(){

    it.skip('post message', function(){
      // TODO implement test
    })

    it.skip('poll and dispatch', function(){
      // TODO implement test
    })

  })

})
