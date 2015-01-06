var expect = require('chai').expect
var EAgent = require('../src/p2ptrade').Agent.EAgent
var MyEProposal = require('../src/p2ptrade').ProtocolObjects.MyEProposal
var EOffer = require('../src/p2ptrade').ProtocolObjects.EOffer
var MyEOffer = require('../src/p2ptrade').ProtocolObjects.MyEOffer
var dictLength = require('../src/p2ptrade').Utils.dictLength

function mockMyEOffer(){
  return EOffer.from_data({
    "oid": "test_my_offer",
    "A": { "color_spec": "", "value": 100000000 },
    "B": { "color_spec": "mock_color_spec", "value": 100000000 }
  })
}

function mockTheirEOffer(){
  return EOffer.from_data({
    "oid": "test_their_offer",
    "A": { "color_spec": "mock_color_spec", "value": 100000000 },
    "B": { "color_spec": "", "value": 100000000 }
  })
}

/**
 * Mock Ewctrl
 */
function MockEWCtrl(){
  //
}

MockEWCtrl.prototype.make_etx_spec = function(a,b){
  return { get_data: function() { return "mock_etx_spec" } }
}
MockEWCtrl.prototype.make_reply_tx = function(etx_spec, a, b){
  return { toHex: function(){ return "mock_reply_tx_hex";} }
}

/**
 * Mock Comm
 */
function MockComm(){
  this.agents = []
  this.messages = []
}

MockComm.prototype.addAgent = function(agent){
  this.agents.push(agent)
}

MockComm.prototype.post_message = function(message){
  this.messages.push(message)
}

/**
 * Mock ExchangeProposal
 */
function MockExchangeProposal(){
  this.offer = { oid: "testoid" }
  this.reply_ep = {
    get_data: function(){
      return "mock_ep_data"
    }
  }
}

MockExchangeProposal.prototype.accept = function(my_offer){
  return this.reply_ep
}

/**
 * Test P2PTrade Agent
 */
describe('P2PTrade Agent', function(){
  var config
  var ewctrl
  var agent
  var comm

  beforeEach(function () {
    config = { 
      ep_expiry_interval: 42, 
      offer_expiry_interval: 42,
      offer_grace_interval: 0
    }
    ewctrl = new MockEWCtrl()
    comm = new MockComm()
    agent = new EAgent(ewctrl, config, comm)
  })

  afterEach(function () {
    //
  })

  it('fire_event handles correct type', function(){
    var handled = false
    var received = null
    agent.set_event_handler('b', function(data){
      received = data
      handled = true
    })
    agent.fire_event('b', "test")
    expect(handled).to.deep.equal(true)
    expect(received).to.deep.equal("test")
  })

  it('fire_event ignores incorrect type', function(){
    var handled = false
    agent.set_event_handler('a', function(data){
      handled = true
    })
    agent.fire_event('b', "test")
    expect(handled).to.deep.equal(false)
  })

  it('set_active_ep clears', function(){
    agent.ep_timeout = "test"
    agent.active_ep = "test"
    agent.set_active_ep(null)
    expect(agent.ep_timeout).to.be.null
    expect(agent.active_ep).to.be.null
  })

  it('set_active_ep updates', function(){
    var config = { ep_expiry_interval: 0 }
    var agent = new EAgent(null, config, new MockComm())

    agent.set_active_ep("test")
    expect(agent.active_ep).to.deep.equal("test")
    expect(agent.ep_timeout > 1400000000).to.be.true
  })

  it('has_active_ep', function(){
    expect(agent.has_active_ep()).to.be.false
    agent.set_active_ep("test")
    expect(agent.has_active_ep()).to.be.true
  })

  it('has_active_ep checks timeout', function(){
    var config = { ep_expiry_interval: -42 }
    var agent = new EAgent(null, config, new MockComm())

    expect(agent.has_active_ep()).to.be.false
    agent.set_active_ep("test")
    expect(agent.has_active_ep()).to.be.false
  })

  it('service_my_offers ignores non auto_post', function(){
    agent.register_my_offer(mockMyEOffer())
    agent.service_my_offers()
    expect(comm.messages.length == 0).to.be.true
  })

  it('service_my_offers ignores active_ep.my_offer', function(){
    var my_offer = MyEOffer.from_data({
      "oid": "test_my_offer",
      "A": { "color_spec": "", "value": 100000000 },
      "B": { "color_spec": "mock_color_spec", "value": 100000000 }
    })
    agent.register_my_offer(my_offer)
    agent.set_active_ep({my_offer: my_offer})
    agent.service_my_offers()
    expect(comm.messages.length == 0).to.be.true
  })

  it('service_my_offers', function(){
    var my_offer = MyEOffer.from_data({
      "oid": "test_my_offer",
      "A": { "color_spec": "", "value": 100000000 },
      "B": { "color_spec": "mock_color_spec", "value": 100000000 }
    })
    agent.register_my_offer(my_offer)
    agent.service_my_offers()
    expect(comm.messages.length == 1).to.be.true // expired by default
    agent.service_my_offers()
    expect(comm.messages.length == 1).to.be.true // ignores unexpired
  })

  it('service_their_offers removes expired', function(){
    config = { 
      ep_expiry_interval: 42, 
      offer_expiry_interval: -42,
      offer_grace_interval: 0
    }
    ewctrl = new MockEWCtrl()
    comm = new MockComm()
    agent = new EAgent(ewctrl, config, comm)
    agent.register_their_offer(mockTheirEOffer())
    agent.service_their_offers()
    expect(dictLength(agent.their_offers) == 0).to.be.true
  })

  it('service_their_offers ignores unexpired', function(){
    agent.register_their_offer(mockTheirEOffer())
    agent.service_their_offers()
    expect(dictLength(agent.their_offers) == 1).to.be.true
  })

  it('register_my_offer', function(){
    expect(agent.my_offers).to.deep.equal({}) // previously empty
    expect(agent.offers_updated).to.be.false // previously unset
    var offer = mockMyEOffer()
    agent.register_my_offer(offer)
    expect(agent.offers_updated).to.be.true // sets flag
    expect(agent.my_offers).to.deep.equal({test_my_offer:offer}) // offer saved
  })

  it('cancel_my_offer clears active_ep', function(){
    var offer = mockMyEOffer()
    var ep = { offer: offer, my_offer: offer }
    agent.set_active_ep(ep)
    agent.cancel_my_offer(offer)
    expect(agent.has_active_ep()).to.be.false
  })

  it('cancel_my_offer clears my_offers', function(){
    var offer = mockMyEOffer()
    agent.register_my_offer(offer)
    agent.cancel_my_offer(offer)
    expect(agent.my_offers).to.deep.equal({})
  })

  it('register_their_offer', function(){
    expect(agent.my_offers).to.deep.equal({}) // previously empty
    expect(agent.offers_updated).to.be.false // previously unset
    var offer = { oid:"test" }

    // monkeypatch refresh
    var refresh_interval = 0
    offer.refresh = function(interval){ refresh_interval = interval }

    agent.register_their_offer(offer)
    expect(refresh_interval).to.deep.equal(42) // called refresh
    expect(agent.offers_updated).to.be.true // sets flag
    expect(agent.their_offers).to.deep.equal({test:offer}) // offer saved
  })

  it('match_offers does nothing if has active ep ', function(){
    agent.set_active_ep("test")
    expect(agent.match_offers()).to.be.false
  })

  it('match_offers ignores unmatching', function(){
    my_offer = EOffer.from_data({
      "oid": "my_oid",
      "A": { "color_spec": "mock_my_color_spec", "value": 100000000 }, 
      "B": { "color_spec": "", "value": 100000000 }
    })
    their_offer = EOffer.from_data({
      "oid": "their_oid",
      "A": { "color_spec": "", "value": 100000000 },
      "B": { "color_spec": "mock_their_color_spec", "value": 100000000 }
    })
    agent.register_my_offer(my_offer)
    agent.register_their_offer(their_offer)
    expect(agent.match_offers()).to.be.false
  })

  it('match_offers finds matching', function(){
    my_offer = EOffer.from_data({
      "oid": "my_oid",
      "A": { "color_spec": "mock_color_spec", "value": 100000000 }, 
      "B": { "color_spec": "", "value": 100000000 }
    })
    their_offer = EOffer.from_data({
      "oid": "their_oid",
      "A": { "color_spec": "", "value": 100000000 },
      "B": { "color_spec": "mock_color_spec", "value": 100000000 }
    })
    agent.register_my_offer(my_offer)
    agent.register_their_offer(their_offer)
    expect(agent.match_offers()).to.be.true

    // check if make_exchange_proposal called
    expect(agent.has_active_ep()).to.be.true
    expect(comm.messages.length > 0).to.be.true
  })

  it('make_exchange_proposal', function(){
    var my_offer = mockMyEOffer()
    var their_offer = mockTheirEOffer()

    agent.make_exchange_proposal(their_offer, my_offer)
    expect(agent.has_active_ep()).to.be.true
    expect(comm.messages.length > 0).to.be.true
  })

  it('make_exchange_proposal fails if active ep', function(){
    agent.set_active_ep("test")
    expect(function(){ agent.make_exchange_proposal('o', 'm') }).to.throw(Error)
  })

  it('dispatch_exchange_proposal updates active_ep if matches', function(){
    // update_exchange_proposal if active_ep and matching pid
   
    var my_offer = mockMyEOffer()
    var their_offer = mockTheirEOffer()
    agent.make_exchange_proposal(their_offer, my_offer)
    agent.active_ep.process_reply = function (ep) {
      // monkeypatch to not process reply
    }
    var data = { 
      'pid' : agent.active_ep.pid, 'offer' : mockMyEOffer(),
      'etx_spec' : 'mock_etx_spec'
    }
    expect(agent.dispatch_exchange_proposal(data)).to.be.true
  })

  it('dispatch_exchange_proposal accepts offer if matches', function(){
    // accept_exchange_proposal if no active_ep and matching oid
   
    var data = { 
      'pid' : 'mock_pid', 'offer' : mockMyEOffer(),
      'etx_spec' : 'mock_etx_spec'
    }
    agent.register_my_offer(mockMyEOffer())
    expect(agent.dispatch_exchange_proposal(data)).to.be.true
    expect(agent.has_active_ep()).to.be.true
    expect(comm.messages.length > 0).to.be.true
  })

  it('dispatch_exchange_proposal removes their_offer if no matches', function(){
    var data = { 'pid' : 'mock_pid', 'offer' : mockTheirEOffer() }
    agent.register_their_offer(mockTheirEOffer())
    expect(dictLength(agent.their_offers) == 1).to.be.true
    expect(agent.dispatch_exchange_proposal(data)).to.be.false
    expect(dictLength(agent.their_offers) == 0).to.be.true
  })

  it('accept_exchange_proposal', function(){
    var ep = new MockExchangeProposal()
    agent.register_my_offer(mockMyEOffer())
    expect(agent.accept_exchange_proposal(ep)).to.be.true
    expect(agent.active_ep).to.deep.equal(ep.reply_ep)
    expect(comm.messages).to.deep.equal([ep.reply_ep.get_data()])
  })

  it('clear_orders', function(){
    var my_offer = mockMyEOffer()
    agent.my_offers = { "test_my_offer": my_offer }
    var their_offer = mockTheirEOffer()
    agent.their_offers = { "test_their_offer": their_offer }

    // test clear MyEProposal
    agent.clear_orders(new MyEProposal(ewctrl, their_offer, my_offer))
    expect(agent.my_offers).to.deep.equal({})
    expect(agent.their_offers).to.deep.equal({})

    // test clear other
    agent.my_offers = { "test_my_offer": my_offer}
    agent.clear_orders({ offer: my_offer })
    expect(agent.my_offers).to.deep.equal({})
  })

  it('update_exchange_proposal', function(){

    // setup my_ep
    var my_offer = mockMyEOffer()
    var their_offer = mockTheirEOffer()
    var my_ep = new MyEProposal(ewctrl, their_offer, my_offer)

    // monkeypatch process_reply
    var process_reply_called = false
    my_ep.process_reply = function(ep){ process_reply_called = true }

    var reply_ep = {
      pid: "reply_pid",
      process_reply: function(ep){},
      offer: mockMyEOffer()
    }

    agent.set_active_ep(my_ep)
    agent.update_exchange_proposal(reply_ep)
    expect(process_reply_called).to.be.true
    expect(agent.has_active_ep()).to.be.false
    expect(comm.messages.length > 0).to.be.true
  })

  it('post_message', function(){
    var obj = { get_data: function(){ return "test"} }
    agent.post_message(obj)
    expect(comm.messages).to.deep.equal(["test"])
  })

  it.skip('dispatch_message', function(){
    // TODO how to test it?
    expect(false).to.be.true
  })

  it.skip('update', function(){
    // TODO how to test it?
    expect(false).to.be.true
  })

})

