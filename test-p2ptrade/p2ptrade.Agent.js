var expect = require('chai').expect
var EAgent = require('../src/p2ptrade').Agent.EAgent
var MyEProposal = require('../src/p2ptrade').ProtocolObjects.MyEProposal
var EOffer = require('../src/p2ptrade').ProtocolObjects.EOffer
var dictLength = require('../src/p2ptrade').Utils.dictLength
var ccCore = require('cc-wallet-core');
var OperationalETxSpec = require('../src/p2ptrade').EWCtrl.OperationalETxSpec
var EWalletController = require('../src/p2ptrade').EWCtrl.EWalletController
var BIP39 = require('bip39')
var ColorDefinition = ccCore.cclib.ColorDefinition
var ccWallet = ccCore.Wallet

// fixtures
var fixtures = require('./fixtures/p2ptrade.protocol.json')
var alice = fixtures.wallet.alice // 123000 gold
var bob = fixtures.wallet.bob // 3300000 btc
var assetdefs = fixtures.assetDefinitions
var color_spec = assetdefs[0]["colorDescs"][0] // gold

function myEOffer(){
  return EOffer.fromData({
    "oid": "test_my_offer",
    "A": { "color_spec": "", "value": 200000 },
    "B": { "color_spec": color_spec, "value": 100000 }
  })
}

function theirEOffer(){
  return EOffer.fromData({
    "oid": "test_their_offer",
    "A": { "color_spec": color_spec, "value": 100000 },
    "B": { "color_spec": "", "value": 200000 }
  })
}

/**
 * Mock Ewctrl
 */
function MockEWCtrl(){
  //
}

MockEWCtrl.prototype.makeEtxSpec = function(a,b, cb){
  cb(null, { getData: function() { return mock_etx_spec } })
}
MockEWCtrl.prototype.makeReplyTx = function(etx_spec, a, b, cb){
  cb(null, { toHex: function(){ return "mock_reply_tx_hex";} })
}

MockEWCtrl.prototype.resolveColorDesc = function(color_desc){
  return new ColorDefinition(0)
}

var mock_etx_spec = {
  inputs: [],
  targets: []
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
  this.offer = myEOffer()
  this.etx_spec = mock_etx_spec
  this.reply_ep = {
    validate: function(cb){ cb(null)},
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

  var seed
  var wallet
  var ewctrl
  var config
  var agent
  var comm

  beforeEach(function(done) {

    // testnet wallet/ewctrl
    localStorage.clear()
    seed = BIP39.mnemonicToSeedHex(bob.mnemonic, bob.password)
    wallet = new ccWallet({
      testnet: true,
      systemAssetDefinitions: assetdefs
    })
    wallet.initialize(seed)
    ewctrl = new EWalletController(wallet, seed)
    ewctrl.neverSendOnPublishTx = true

    // test agent
    config = { 
      ep_expiry_interval: 42, 
      offer_expiry_interval: 42,
      offer_grace_interval: 0
    }
    comm = new MockComm()
    agent = new EAgent(ewctrl, config, comm)

    wallet.once('syncStop', done)
  })

  afterEach(function () {
    wallet.removeListeners()
    wallet.clearStorage()
    wallet = undefined
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

  it('serviceMyOffers ignores activeEP.my_offer', function(){
    var my_offer = EOffer.fromData({
      "oid": "test_my_offer",
      "A": { "color_spec": "", "value": 100000 },
      "B": { "color_spec": color_spec, "value": 100000 }
    })
    agent.registerMyOffer(my_offer)
    agent.setActiveEP({my_offer: my_offer})
    agent.serviceMyOffers()
    expect(comm.messages.length == 0).to.be.true
  })

  it('serviceMyOffers', function(){
    var my_offer = EOffer.fromData({
      "oid": "test_my_offer",
      "A": { "color_spec": "", "value": 100000 },
      "B": { "color_spec": color_spec, "value": 100000 }
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
    agent.registerTheirOffer(theirEOffer())
    agent.serviceTheirOffers()
    expect(dictLength(agent.theirOffers) == 0).to.be.true
  })

  it('serviceTheirOffers ignores unexpired', function(){
    agent.registerTheirOffer(theirEOffer())
    agent.serviceTheirOffers()
    expect(dictLength(agent.theirOffers) == 1).to.be.true
  })

  it('registerMyOffer', function(){
    expect(agent.myOffers).to.deep.equal({}) // previously empty
    expect(agent.offersUpdated).to.be.false // previously unset
    var offer = myEOffer()
    agent.registerMyOffer(offer)
    expect(agent.offersUpdated).to.be.true // sets flag
    expect(agent.myOffers).to.deep.equal({test_my_offer:offer}) // offer saved
  })

  it('cancel_my_offer clears activeEP', function(){
    var offer = myEOffer()
    var ep = { offer: offer, my_offer: offer }
    agent.setActiveEP(ep)
    agent.cancelMyOffer(offer)
    expect(agent.hasActiveEP()).to.be.false
  })

  it('cancel_my_offer clears myOffers', function(){
    var offer = myEOffer()
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

  it('matchOffers does nothing if has active ep ', function(done){
    agent.setActiveEP("test")
    agent.matchOffers(function(error, ep){
      expect(error).to.be.null
      expect(ep).to.be.null
      done()
    })
  })

  it('matchOffers ignores unmatching', function(done){
    var my_offer = EOffer.fromData({
      "oid": "my_oid",
      "A": { "color_spec": "mock_my_color_spec", "value": 100000 }, 
      "B": { "color_spec": "", "value": 100000 }
    })
    var their_offer = EOffer.fromData({
      "oid": "their_oid",
      "A": { "color_spec": "", "value": 100000 },
      "B": { "color_spec": "mock_their_color_spec", "value": 100000 }
    })
    agent.registerMyOffer(my_offer)
    agent.registerTheirOffer(their_offer)
    agent.matchOffers(function(error, ep){
      expect(error).to.be.null
      expect(ep).to.be.null
      done()
    })
  })

  it('matchOffers finds matching', function(done){
    var my_offer = EOffer.fromData({
      "oid": "my_oid",
      "A": { "color_spec": "", "value": 100000 },
      "B": { "color_spec": color_spec, "value": 100000 }
    })
    var their_offer = EOffer.fromData({
      "oid": "their_oid",
      "A": { "color_spec": color_spec, "value": 100000 }, 
      "B": { "color_spec": "", "value": 100000 }
    })
    agent.registerMyOffer(my_offer)
    agent.registerTheirOffer(their_offer)
    agent.matchOffers(function(error, ep){
      expect(error).to.be.null
      expect(ep).to.not.be.null

      // check if makeExchangeProposal called
      expect(agent.hasActiveEP()).to.be.true
      expect(comm.messages.length > 0).to.be.true
      done()
    })


  })

  it('makeExchangeProposal', function(done){
    var my_offer = myEOffer()
    var their_offer = theirEOffer()
    agent.makeExchangeProposal(their_offer, my_offer, function(error, ep){
      if(error) { throw error }
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

  it.skip('dispatchExchangeProposal updates activeEP if matches', function(done){
    // update_exchange_proposal if activeEP and matching pid
   
    // FIXME how does this test anything?
    var my_offer = myEOffer()
    var their_offer = theirEOffer()
    agent.makeExchangeProposal(their_offer, my_offer, function(error, ep){
      agent.activeEP.processReply = function (ep) {
        // monkeypatch to not process reply
      }
      expect(error).to.be.null
      var data = { 
        'pid' : ep.pid, 'offer' : myEOffer(),
        'etx_spec' : mock_etx_spec
      }
      agent.dispatchExchangeProposal(data, function(error){
        expect(error).to.be.null
        // FIXME shouldn't i be testing something here
        done()
      })
    })
  })

  it.skip('dispatchExchangeProposal accepts offer if matches', function(done){
    // acceptExchangeProposal if no activeEP and matching oid
    // FIXME can't use mock_etx_spec
   
    var data = { 
      'pid' : 'mock_pid', 'offer' : myEOffer(),
      'etx_spec' : mock_etx_spec
    }
    agent.registerMyOffer(myEOffer())
    agent.dispatchExchangeProposal(data, function(error){
      if(error){ throw error }
      expect(agent.hasActiveEP()).to.be.true
      expect(comm.messages.length > 0).to.be.true
      done()
    })
  })

  it('dispatchExchangeProposal removes their_offer if no matches', function(done){
    var data = { 'pid' : 'mock_pid', 'offer' : theirEOffer() }
    agent.registerTheirOffer(theirEOffer())
    expect(dictLength(agent.theirOffers) == 1).to.be.true
    agent.dispatchExchangeProposal(data, function(error){
      expect(error).to.be.null
      expect(dictLength(agent.theirOffers) == 0).to.be.true
      done()
    })
  })

  it('acceptExchangeProposal', function(done){
    var ep = new MockExchangeProposal()
    agent.registerMyOffer(myEOffer())
    agent.acceptExchangeProposal(ep, function(error){
      expect(error).to.be.null
      expect(agent.activeEP).to.deep.equal(ep.reply_ep)
      expect(comm.messages).to.deep.equal([ep.reply_ep.getData()])
      done()
    })
  })

  it('clearOrders', function(){
    var my_offer = myEOffer()
    agent.myOffers = { "test_my_offer": my_offer }
    var their_offer = theirEOffer()
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
    var my_offer = myEOffer()
    var their_offer = theirEOffer()
    var etxSpec = { getData: function() { return mock_etx_spec } }
    var my_ep = new MyEProposal(ewctrl, their_offer, my_offer, etxSpec)

    // monkeypatch processReply
    var process_reply_called = false
    my_ep.processReply = function(ep){ process_reply_called = true }

    var reply_ep = {
      pid: "reply_pid",
      processReply: function(ep){},
      offer: myEOffer()
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

