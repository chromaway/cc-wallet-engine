var expect = require('chai').expect
var EAgent = require('../src/p2ptrade').Agent.EAgent
var MyEProposal = require('../src/p2ptrade').ProtocolObjects.MyEProposal
var EOffer = require('../src/p2ptrade').ProtocolObjects.EOffer
var dictLength = require('../src/p2ptrade').Utils.dictLength

function mockMyEOffer(){
  return EOffer.fromData({
    "oid": "test_my_offer",
    "A": { "color_spec": "", "value": 100000000 },
    "B": { "color_spec": "mock_color_spec", "value": 100000000 }
  })
}

function mockTheirEOffer(){
  return EOffer.fromData({
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

MockEWCtrl.prototype.makeEtxSpec = function(a,b, cb){
  cb(null, { getData: function() { return "mock_etx_spec" } })
}
MockEWCtrl.prototype.makeReplyTx = function(etx_spec, a, b, cb){
  cb(null, { toHex: function(){ return "mock_reply_tx_hex";} })
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

MockComm.prototype.postMessage = function(message){
  this.messages.push(message)
}

/**
 * Mock ExchangeProposal
 */
function MockExchangeProposal(){
  this.offer = mockMyEOffer()
  this.etx_spec = "mock_etx_spec"
  this.reply_ep = {
    getData: function(){
      return "mock_ep_data"
    }
  }
}

MockExchangeProposal.prototype.accept = function(my_offer, cb){
  cb(null, this.reply_ep)
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
    agent.setEventHandler('b', function(data){
      received = data
      handled = true
    })
    agent.fireEvent('b', "test")
    expect(handled).to.deep.equal(true)
    expect(received).to.deep.equal("test")
  })

  it('fire_event ignores incorrect type', function(){
    var handled = false
    agent.setEventHandler('a', function(data){
      handled = true
    })
    agent.fireEvent('b', "test")
    expect(handled).to.deep.equal(false)
  })

  it('setActiveEP clears', function(){
    agent.epTimeout = "test"
    agent.activeEP = "test"
    agent.setActiveEP(null)
    expect(agent.epTimeout).to.be.null
    expect(agent.activeEP).to.be.null
  })

  it('setActiveEP updates', function(){
    var config = { ep_expiry_interval: 0 }
    var agent = new EAgent(null, config, new MockComm())

    agent.setActiveEP("test")
    expect(agent.activeEP).to.deep.equal("test")
    expect(agent.epTimeout > 1400000000).to.be.true
  })

  it('hasActiveEP', function(){
    expect(agent.hasActiveEP()).to.be.false
    agent.setActiveEP("test")
    expect(agent.hasActiveEP()).to.be.true
  })

  it('hasActiveEP checks timeout', function(){
    var config = { ep_expiry_interval: -42 }
    var agent = new EAgent(null, config, new MockComm())

    expect(agent.hasActiveEP()).to.be.false
    agent.setActiveEP("test")
    expect(agent.hasActiveEP()).to.be.false
  })

  it('service_my_offers ignores non auto_post', function(){
    agent.registerMyOffer(mockMyEOffer())
    agent.serviceMyOffers()
    expect(comm.messages.length == 0).to.be.true
  })

  it('service_my_offers ignores activeEP.my_offer', function(){
    var my_offer = EOffer.fromData({
      "oid": "test_my_offer",
      "A": { "color_spec": "", "value": 100000000 },
      "B": { "color_spec": "mock_color_spec", "value": 100000000 }
    })
    agent.registerMyOffer(my_offer)
    agent.setActiveEP({my_offer: my_offer})
    agent.serviceMyOffers()
    expect(comm.messages.length == 0).to.be.true
  })

  it('service_my_offers', function(){
    var my_offer = EOffer.fromData({
      "oid": "test_my_offer",
      "A": { "color_spec": "", "value": 100000000 },
      "B": { "color_spec": "mock_color_spec", "value": 100000000 }
    })
    agent.registerMyOffer(my_offer)
    agent.serviceMyOffers()
    expect(comm.messages.length == 1).to.be.true // expired by default
    agent.serviceMyOffers()
    expect(comm.messages.length == 1).to.be.true // ignores unexpired
  })

  it('serviceTheirOffers removes expired', function(){
    config = { 
      ep_expiry_interval: 42, 
      offer_expiry_interval: -42,
      offer_grace_interval: 0
    }
    ewctrl = new MockEWCtrl()
    comm = new MockComm()
    agent = new EAgent(ewctrl, config, comm)
    agent.registerTheirOffer(mockTheirEOffer())
    agent.serviceTheirOffers()
    expect(dictLength(agent.theirOffers) == 0).to.be.true
  })

  it('serviceTheirOffers ignores unexpired', function(){
    agent.registerTheirOffer(mockTheirEOffer())
    agent.serviceTheirOffers()
    expect(dictLength(agent.theirOffers) == 1).to.be.true
  })

  it('registerMyOffer', function(){
    expect(agent.myOffers).to.deep.equal({}) // previously empty
    expect(agent.offersUpdated).to.be.false // previously unset
    var offer = mockMyEOffer()
    agent.registerMyOffer(offer)
    expect(agent.offersUpdated).to.be.true // sets flag
    expect(agent.myOffers).to.deep.equal({test_my_offer:offer}) // offer saved
  })

  it('cancel_my_offer clears activeEP', function(){
    var offer = mockMyEOffer()
    var ep = { offer: offer, my_offer: offer }
    agent.setActiveEP(ep)
    agent.cancelMyOffer(offer)
    expect(agent.hasActiveEP()).to.be.false
  })

  it('cancel_my_offer clears myOffers', function(){
    var offer = mockMyEOffer()
    agent.registerMyOffer(offer)
    agent.cancelMyOffer(offer)
    expect(agent.myOffers).to.deep.equal({})
  })

  it('registerTheirOffer', function(){
    expect(agent.myOffers).to.deep.equal({}) // previously empty
    expect(agent.offersUpdated).to.be.false // previously unset
    var offer = { oid:"test" }

    // monkeypatch refresh
    var refresh_interval = 0
    offer.refresh = function(interval){ refresh_interval = interval }

    agent.registerTheirOffer(offer)
    expect(refresh_interval).to.deep.equal(42) // called refresh
    expect(agent.offersUpdated).to.be.true // sets flag
    expect(agent.theirOffers).to.deep.equal({test:offer}) // offer saved
  })

  it('matchOffers does nothing if has active ep ', function(){
    agent.setActiveEP("test")
    expect(agent.matchOffers()).to.be.false
  })

  it('matchOffers ignores unmatching', function(){
    my_offer = EOffer.fromData({
      "oid": "my_oid",
      "A": { "color_spec": "mock_my_color_spec", "value": 100000000 }, 
      "B": { "color_spec": "", "value": 100000000 }
    })
    their_offer = EOffer.fromData({
      "oid": "their_oid",
      "A": { "color_spec": "", "value": 100000000 },
      "B": { "color_spec": "mock_their_color_spec", "value": 100000000 }
    })
    agent.registerMyOffer(my_offer)
    agent.registerTheirOffer(their_offer)
    expect(agent.matchOffers()).to.be.false
  })

  it('matchOffers finds matching', function(done){
    my_offer = EOffer.fromData({
      "oid": "my_oid",
      "A": { "color_spec": "mock_color_spec", "value": 100000000 }, 
      "B": { "color_spec": "", "value": 100000000 }
    })
    their_offer = EOffer.fromData({
      "oid": "their_oid",
      "A": { "color_spec": "", "value": 100000000 },
      "B": { "color_spec": "mock_color_spec", "value": 100000000 }
    })
    agent.registerMyOffer(my_offer)
    agent.registerTheirOffer(their_offer)
    expect(agent.matchOffers()).to.be.true

    // check if makeExchangeProposal called
    setTimeout(function(){
      expect(agent.hasActiveEP()).to.be.true
      expect(comm.messages.length > 0).to.be.true
      done()
    }, 500)
  })

  it('makeExchangeProposal', function(done){
    var my_offer = mockMyEOffer()
    var their_offer = mockTheirEOffer()
    agent.makeExchangeProposal(their_offer, my_offer, function(error, ep){
      expect(error).to.be.null
      expect(agent.hasActiveEP()).to.be.true
      expect(comm.messages.length > 0).to.be.true
      done()
    })
  })

  it('makeExchangeProposal fails if active ep', function(done){
    agent.setActiveEP("test")
    agent.makeExchangeProposal('o', 'm', function(error, ep){
      expect(!error).to.be.false
      done()
    })
  })

  it('dispatchExchangeProposal updates activeEP if matches', function(done){
    // update_exchange_proposal if activeEP and matching pid
   
    // FIXME how does this test anything?
    var my_offer = mockMyEOffer()
    var their_offer = mockTheirEOffer()
    agent.makeExchangeProposal(their_offer, my_offer, function(error, ep){
      agent.activeEP.processReply = function (ep) {
        // monkeypatch to not process reply
      }
      expect(error).to.be.null
      var data = { 
        'pid' : ep.pid, 'offer' : mockMyEOffer(),
        'etx_spec' : 'mock_etx_spec'
      }
      agent.dispatchExchangeProposal(data, function(error){
        expect(error).to.be.null
        // FIXME shouldn't i be testing something here
        done()
      })
    })
  })

  it('dispatchExchangeProposal accepts offer if matches', function(done){
    // acceptExchangeProposal if no activeEP and matching oid
   
    var data = { 
      'pid' : 'mock_pid', 'offer' : mockMyEOffer(),
      'etx_spec' : 'mock_etx_spec'
    }
    agent.registerMyOffer(mockMyEOffer())
    agent.dispatchExchangeProposal(data, function(error){
      expect(error).to.be.null
      expect(agent.hasActiveEP()).to.be.true
      expect(comm.messages.length > 0).to.be.true
      done()
    })
  })

  it('dispatchExchangeProposal removes their_offer if no matches', function(done){
    var data = { 'pid' : 'mock_pid', 'offer' : mockTheirEOffer() }
    agent.registerTheirOffer(mockTheirEOffer())
    expect(dictLength(agent.theirOffers) == 1).to.be.true
    agent.dispatchExchangeProposal(data, function(error){
      expect(error).to.be.null
      expect(dictLength(agent.theirOffers) == 0).to.be.true
      done()
    })
  })

  it('acceptExchangeProposal', function(done){
    var ep = new MockExchangeProposal()
    agent.registerMyOffer(mockMyEOffer())
    agent.acceptExchangeProposal(ep, function(error){
      expect(error).to.be.null
      expect(agent.activeEP).to.deep.equal(ep.reply_ep)
      expect(comm.messages).to.deep.equal([ep.reply_ep.getData()])
      done()
    })
  })

  it('clearOrders', function(){
    var my_offer = mockMyEOffer()
    agent.myOffers = { "test_my_offer": my_offer }
    var their_offer = mockTheirEOffer()
    agent.theirOffers = { "test_their_offer": their_offer }

    // test clear MyEProposal
    agent.clearOrders(new MyEProposal(ewctrl, their_offer, my_offer))
    expect(agent.myOffers).to.deep.equal({})
    expect(agent.theirOffers).to.deep.equal({})

    // test clear other
    agent.myOffers = { "test_my_offer": my_offer}
    agent.clearOrders({ offer: my_offer })
    expect(agent.myOffers).to.deep.equal({})
  })

  it('finishExchangeProposal', function(done){

    // setup my_ep
    var my_offer = mockMyEOffer()
    var their_offer = mockTheirEOffer()
    var etxSpec = { getData: function() { return "mock_etx_spec" } }
    var my_ep = new MyEProposal(ewctrl, their_offer, my_offer, etxSpec)

    // monkeypatch processReply
    var process_reply_called = false
    my_ep.processReply = function(ep){ process_reply_called = true }

    var reply_ep = {
      pid: "reply_pid",
      processReply: function(ep){},
      offer: mockMyEOffer()
    }

    agent.setActiveEP(my_ep)
    agent.finishExchangeProposal(reply_ep, function(error){
      expect(process_reply_called).to.be.true
      expect(agent.hasActiveEP()).to.be.false
      expect(comm.messages.length > 0).to.be.true
      done()
    })
  })

  it('postMessage', function(){
    var obj = { getData: function(){ return "test"} }
    agent.postMessage(obj)
    expect(comm.messages).to.deep.equal(["test"])
  })

  it.skip('dispatchMessage', function(){
    // TODO how to test it?
    expect(false).to.be.true
  })

  it.skip('update', function(){
    // TODO how to test it?
    expect(false).to.be.true
  })

})

