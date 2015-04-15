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
var alice = fixtures.wallet.alice // 123000 gold
var bob = fixtures.wallet.bob // 3300000 btc
var assetdefs = fixtures.assetDefinitions
var color_spec = assetdefs[0]["colorDescs"][0] // gold

// settings
var agentConfig = {
  ep_expiry_interval: 30,
  offer_expiry_interval: 30,
  offer_grace_interval: 0
}
var commConfig = { offer_expiry_interval : 30 }
var commUrl = "http://p2ptrade.btx.udoidio.info/messages"

function MockStore(){
  this.name = "MockStore"
  this.dict = {}
}

MockStore.prototype.get = function (key, defaultValue) {
  return key in this.dict ? this.dict[key] : defaultValue
}

MockStore.prototype.set = function (key, value) {
  this.dict[key] = value
}

MockStore.prototype.remove = function(key){
  this.dict[key] = undefined
}

MockStore.prototype.clear = function () {
  this.dict = {}
}
MockStore.prototype.getAll = function () {
  return this.dict
}

describe('P2PTrade Protocol', function(){

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
      networks: [{name: 'ElectrumJS', args: [{testnet: true}]}],
      autoConnect: false,
      store: new MockStore(),
      blockchain: {name: 'Naive'},
      spendUnconfirmedCoins: true,
      systemAssetDefinitions: assetdefs
    })
    walletAlice.getNetwork().connect()
    walletAlice.initialize(seedAlice)
    ewctrlAlice = new EWalletController(walletAlice, seedAlice)
    ewctrlAlice.neverSendOnPublishTx = true
    commAlice = new ThreadedComm(commConfig, commUrl)
    commAlice.start()
    agentAlice = new EAgent(ewctrlAlice, agentConfig, commAlice)
    agentAlice.name = "alice"

    // setup bob
    seedBob = BIP39.mnemonicToSeedHex(bob.mnemonic, bob.password)
    walletBob = new ccWallet({
      testnet: true,
      networks: [{name: 'ElectrumJS', args: [{testnet: true}]}],
      autoConnect: false,
      store: new MockStore(),
      blockchain: {name: 'Naive'},
      spendUnconfirmedCoins: true,
      systemAssetDefinitions: assetdefs
    })
    walletBob.getNetwork().connect()
    walletBob.initialize(seedBob)
    ewctrlBob = new EWalletController(walletBob, seedBob)
    ewctrlBob.neverSendOnPublishTx = true
    commBob = new ThreadedComm(commConfig, commUrl)
    commBob.start()
    agentBob = new EAgent(ewctrlBob, agentConfig, commBob)
    agentBob.name = "bob"

    // sync wallets
    walletAlice.once('syncStop', function(error){
      if (error){ throw error }
      walletBob.once('syncStop', done)
    })
  })

  afterEach(function () {

    // alice
    walletAlice.getNetwork().disconnect()
    walletAlice.removeListeners()
    walletAlice.clearStorage()
    commAlice.stop()
    walletAlice = undefined
    ewctrlAlice = undefined
    commAlice = undefined
    agentAlice = undefined

    // bob
    walletBob.getNetwork().disconnect()
    walletBob.removeListeners()
    walletBob.clearStorage()
    commBob.stop()
    walletBob = undefined
    ewctrlBob = undefined
    commBob = undefined
    agentBob = undefined
  })

  it('standard usage', function(done){

    var offerAlice = new EOffer( // offer gold for bitcoin
      null, // create random oid
      { "color_spec": color_spec, "value": 50000 },
      { "color_spec": "", "value": 200000 }
    )

    var offerBob = new EOffer( // offer bitcoin for gold
      null, // create random oid
      { "color_spec": "", "value": 200000 },
      { "color_spec": color_spec, "value": 50000 }
    )

    expect(offerAlice.matches(offerBob)).to.be.true
    agentAlice.registerMyOffer(offerAlice)
    agentBob.registerMyOffer(offerBob)

    // alice sends exchange offer
    console.log("##### 1 alice sends exchange offer")
    agentAlice.update()
    setTimeout(function(){ // wait for alice to send exchange offer

      // bob sends exchange proposal
      console.log("##### 2 bob sends exchange proposal")
      agentBob.update()
      setTimeout(function(){ // wait for bob to send exchange proposal
        if(!agentBob.hasActiveEP()) { throw new Error("no active ep bob") }
        expect(agentBob.hasActiveEP()).to.be.true

        // alice sends exchange proposal reply
        console.log("##### 3 alice sends exchange proposal reply")
        agentAlice.update()
        setTimeout(function(){ // wait for alice to send exchange proposal reply
          if(!agentAlice.hasActiveEP()) { throw new Error("no active ep alice") }
          expect(agentAlice.hasActiveEP()).to.be.true

          // bob accepts exchange proposal and publishes tx
          console.log("##### 4 bob accepts exchange proposal and publishes tx")
          agentBob.update()
          setTimeout(function(){ // XXX wait for async bob accept to finish

            // TODO check logged tx
            expect(ewctrlBob.publishedTxLog.length).to.equal(1)

            done()
          }, 10000)
        }, 10000)
      }, 10000)
    }, 10000)
  })
})
