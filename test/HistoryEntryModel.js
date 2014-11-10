var expect = require('chai').expect

var ccWallet = require('cc-wallet-core').Wallet
var _ = require('lodash')
var moment = require('moment')

var AssetModels = require('../src/AssetModels')
var AssetModel = require('../src/AssetModel')
var HistoryEntryModel = require('../src/HistoryEntryModel')


describe('HistoryEntryModel', function() {
  var wallet, assetModels, assetModel, historyEntry

  beforeEach(function(done) {
    wallet = new ccWallet({ testnet: true, blockchain: 'NaiveBlockchain' })
    wallet.initialize('12355564466111166655222222222222')
    wallet.subscribeAndSyncAllAddresses(function(error) {
      expect(error).to.be.null

      assetModels = new AssetModels(wallet)
      var cnt = 0
      assetModels.on('update', function() {
        if (++cnt !== 7)
          return

        expect(assetModels.getAssetModels()).to.have.length(1)
        expect(assetModels.getAssetModels()[0]).to.be.instanceof(AssetModel)
        assetModel = assetModels.getAssetModels()[0]

        expect(assetModel.getHistory()).to.be.instanceof(Array).with.to.have.length(1)
        expect(assetModel.getHistory()[0]).to.be.instanceof(HistoryEntryModel)
        historyEntry = assetModel.getHistory()[0]

        done()
      })
      assetModels.update()
    })
  })

  afterEach(function() {
    wallet.clearStorage()
    delete wallet
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
