var expect = require('chai').expect

var moment = require('moment')

var WalletEngine = require('../src/WalletEngine')
var HistoryEntryModel = require('../src/HistoryEntryModel')


describe('HistoryEntryModel', function () {
  var wallet
  var historyEntry

  beforeEach(function (done) {
    localStorage.clear()
    wallet = new WalletEngine({
      testnet: true,
      blockchain: 'NaiveBlockchain',
      storageSaveTimeout: 0,
      spendUnconfirmedCoins: true
    })
    wallet.on('error', function (error) { throw error })
    wallet.getWallet().initialize('12355564466111166655222222222222')

    wallet.on('historyUpdate', function () { console.log('historyUpdate') })

    wallet.on('syncStop', function () {
      var entries = wallet.getWallet().getHistory()

      expect(entries).to.be.instanceof(Array).with.to.have.length(1)
      historyEntry = new HistoryEntryModel(entries[0])

      done()
    })

    wallet.getWallet().subscribeAndSyncAllAddresses(function (error) {
      expect(error).to.be.null
    })
  })

  afterEach(function () {
    historyEntry = undefined
    wallet.removeListeners()
    wallet.clearStorage()
    wallet = undefined
  })

  it('getTxId', function () {
    expect(historyEntry.getTxId()).to.equal('51e8dfe12367d3a0e9a9c8c558c774b98330561a12a8e3fdc805f6e6d25dc7db')
  })

  it('getDate', function () {
    var timestamp = historyEntry.historyEntry.getTimestamp()
    var date = moment(timestamp * 1000).format('MM/DD/YY HH:mm:ss')
    var expectedValue = (historyEntry.historyEntry.isBlockTimestamp() ? '~' : '') + date
    expect(historyEntry.getDate()).to.equal(expectedValue)
  })

  it('getValues', function () {
    expect(historyEntry.getValues()).to.deep.equal(['0.01000000'])
  })

  it('getTargets', function () {
    var models = historyEntry.getTargets()
    expect(models).to.be.instanceof(Array).with.length(1)
    expect(models[0].getAddress()).to.equal('mv4jLE114t8KHL3LExNGBTXiP2dCjkaWJh')
    expect(models[0].getAssetMoniker()).to.equal('bitcoin')
    expect(models[0].getFormattedValue()).to.equal('0.01000000')
  })

  it('isSend', function () {
    expect(historyEntry.isSend()).to.be.false
  })

  it('isReceive', function () {
    expect(historyEntry.isReceive()).to.be.true
  })

  it('isPaymentToYourself', function () {
    expect(historyEntry.isPaymentToYourself()).to.be.false
  })

  it('getTransactionType', function () {
    expect(historyEntry.getTransactionType()).to.equal('Receive')
  })
})
