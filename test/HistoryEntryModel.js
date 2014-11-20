var expect = require('chai').expect

var Q = require('q')
var ccWallet = require('cc-wallet-core').Wallet
var moment = require('moment')

var AssetModels = require('../src/AssetModels')
var AssetModel = require('../src/AssetModel')
var HistoryEntryModel = require('../src/HistoryEntryModel')


describe('HistoryEntryModel', function () {
  var wallet
  var historyEntry

  beforeEach(function (done) {
    localStorage.clear()
    wallet = new ccWallet({ testnet: true, blockchain: 'NaiveBlockchain' })
    wallet.on('error', function (error) { throw error })
    wallet.initialize('12355564466111166655222222222222')
    wallet.subscribeAndSyncAllAddresses(function (error) {
      expect(error).to.be.null

      var assetModels = new AssetModels({getWallet: function () { return wallet }})
      assetModels.on('error', function (error) { throw error })

      var deferred = Q.defer()
      deferred.promise.then(done)

      assetModels.on('update', function() {
        var models = assetModels.getAssetModels()
        if (models.length === 0) { return }

        expect(models).to.be.instanceof(Array).with.to.have.length(1)
        expect(models[0]).to.be.instanceof(AssetModel)

        var entries = models[0].getHistory()
        if (entries.length === 0) { return }

        expect(entries).to.be.instanceof(Array).with.to.have.length(1)
        expect(entries[0]).to.be.instanceof(HistoryEntryModel)

        historyEntry = entries[0]
        deferred.resolve()
      })
    })
  })

  afterEach(function() {
    historyEntry = undefined
    wallet.removeListeners()
    wallet.clearStorage()
    wallet = undefined
  })

  it('getTxId', function() {
    expect(historyEntry.getTxId()).to.equal('51e8dfe12367d3a0e9a9c8c558c774b98330561a12a8e3fdc805f6e6d25dc7db')
  })

  it('getDate', function() {
    var date = moment(historyEntry.getDate(), 'MM/DD/YY HH:mm:ss')
    date = date.unix() + new Date().getTimezoneOffset() * 60
    expect(date).to.equal(1408465527)
  })

  it('getValues', function() {
    expect(historyEntry.getValues()).to.deep.equal([ '0.01000000' ])
  })

  it('getTargets', function() {
    var models = historyEntry.getTargets()
    expect(models).to.be.instanceof(Array).with.length(1)
    expect(models[0].getAddress()).to.equal('mv4jLE114t8KHL3LExNGBTXiP2dCjkaWJh')
    expect(models[0].getAssetMoniker()).to.equal('bitcoin')
    expect(models[0].getFormattedValue()).to.equal('0.01000000')
  })

  it('isSend', function() {
    expect(historyEntry.isSend()).to.be.false
  })

  it('isReceive', function() {
    expect(historyEntry.isReceive()).to.be.true
  })

  it('isPaymentToYourself', function() {
    expect(historyEntry.isPaymentToYourself()).to.be.false
  })

  it('getTransactionType', function() {
    expect(historyEntry.getTransactionType()).to.equal('Receive')
  })
})
