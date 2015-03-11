var expect = require('chai').expect
var ccCore = require('cc-wallet-core')
var BIP39 = require('bip39')
var ccWallet = ccCore.Wallet
var EAgent = require('../src/p2ptrade').Agent.EAgent
var EOffer = require('../src/p2ptrade').ProtocolObjects.EOffer
var EWalletController = require('../src/p2ptrade').EWCtrl.EWalletController
var ThreadedComm = require('../src/p2ptrade').Comm.ThreadedComm

// fixtures
var fixtures = require('./fixtures/p2ptrade.protocol.json')
var alice = fixtures.wallet.alice
var bob = fixtures.wallet.bob
var assetdefs = fixtures.assetDefinitions

// settings
var agentConfig = { 
  ep_expiry_interval: 42, 
  offer_expiry_interval: 42,
  offer_grace_interval: 0
}
var commConfig = { offer_expiry_interval : 1 }
var commUrl = "http://p2ptrade.btx.udoidio.info/messages"

function HackConfigStorage(){
  this.dict = {}
}

HackConfigStorage.prototype.get = function (key, defaultValue) {
  return key in this.dict ? this.dict[key] : defaultValue
}

HackConfigStorage.prototype.set = function (key, value) {
  this.dict[key] = value
}

HackConfigStorage.prototype.clear = function () {
  this.dict = {}
}

describe.skip('P2PTrade Protocol', function(){ // FIXME get test to work

  var walletAlice
  var ewctrlAlice
  var commAlice
  var agentAlice

  var walletBob
  var ewctrlBob
  var commBob
  var agentBob

  beforeEach(function(done) {
    localStorage.clear()

    // setup alice
    var seedAlice = BIP39.mnemonicToSeedHex(alice.mnemonic, alice.password)
    walletAlice = new ccWallet({
      testnet: true,
      systemAssetDefinitions: assetdefs
    })
    walletAlice.config = new HackConfigStorage()
    walletAlice.initialize(seedAlice)
    ewctrlAlice = new EWalletController(walletAlice, seedAlice)
    ewctrlAlice.neverSendOnPublishTx = true
    commAlice = new ThreadedComm(commConfig, commUrl)
    agentAlice = new EAgent(ewctrlAlice, agentConfig, commAlice)

    // setup bob
    seedBob = BIP39.mnemonicToSeedHex(bob.mnemonic, bob.password)
    walletBob = new ccWallet({
      testnet: true,
      systemAssetDefinitions: assetdefs
    })
    walletBob.config = new HackConfigStorage()
    walletBob.initialize(seedBob)
    ewctrlBob = new EWalletController(walletBob, seedBob)
    ewctrlBob.neverSendOnPublishTx = true
    commBob = new ThreadedComm(commConfig, commUrl)
    agentBob = new EAgent(ewctrlBob, agentConfig, commBob)

    // sync wallets
    walletAlice.once('syncStop', function(error){
      if (error){ throw error }
      walletBob.once('syncStop', done)
    })
  })

  afterEach(function () {

    // alice
    walletAlice.removeListeners()
    walletAlice.clearStorage()
    walletAlice = undefined

    // bob
    walletBob.removeListeners()
    walletBob.clearStorage()
    walletBob = undefined
  })

  it('standard usage', function(done){

    var offerAlice = new EOffer( // offer gold for bitcoin
      null, // create random oid
      { "color_spec": "epobc:b95323a763fa507110a89ab857af8e949810cf1e67e91104cd64222a04ccd0bb:0:180679", "value": 50000 },
      { "color_spec": "", "value": 100000 }
    )

    var offerBob = new EOffer( // offer bitcoin for gold
      null, // create random oid
      { "color_spec": "", "value": 100000 },
      { "color_spec": "epobc:b95323a763fa507110a89ab857af8e949810cf1e67e91104cd64222a04ccd0bb:0:180679", "value": 50000 }
    )

    expect(offerAlice.matches(offerBob)).to.be.true
    agentAlice.registerMyOffer(offerAlice)
    agentBob.registerMyOffer(offerBob)

    // alice sends exchange offer
    agentAlice.update()
    setTimeout(function(){ // wait for alice to send exchange offer

      // bob sends exchange proposal
      agentBob.update()
      console.log("agentBob.theirOffers")
      console.log(agentBob.theirOffers)
      if(!agentBob.hasActiveEP()) { throw new Error("no active ep bob") }
      expect(agentBob.hasActiveEP()).to.be.true
      setTimeout(function(){ // wait for bob to send exchange proposal

        // alice sends exchange proposal reply
        agentAlice.update()
        if(!agentAlice.hasActiveEP()) { throw new Error("no active ep alice") }
        expect(agentAlice.hasActiveEP()).to.be.true
        setTimeout(function(){ // wait for alice to send exchange proposal reply

          // bob accepts exchange proposal and publishes tx
          agentBob.update()
          
          // TODO check logged tx 
          expect(ewctrlBob.publishedTxLog.length).to.equal(1)

          done()
        }, 5000)
      }, 5000)
    }, 5000)
  })
})
