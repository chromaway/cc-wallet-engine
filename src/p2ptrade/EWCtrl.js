var async = require('async')
var util = require('util')
var WalletCore = require('cc-wallet-core')
var OperationalTx = WalletCore.tx.OperationalTx
var ColorValue = WalletCore.cclib.ColorValue
var ColorTarget = WalletCore.cclib.ColorTarget
var EPOBCColorDefinition = WalletCore.cclib.EPOBCColorDefinition;
var UncoloredColorDefinition = WalletCore.cclib.UncoloredColorDefinition
var ETxSpec = require('./ProtocolObjects').ETxSpec
var Set = require('set')
var bitcoin = WalletCore.bitcoin

/**
 * @class OperationalETxSpec
 */
function OperationalETxSpec(ewctrl){
  OperationalTx.apply(this, [ewctrl.wallet])
  this.ewctrl = ewctrl
  this.ourValueLimit = undefined
}

util.inherits(OperationalETxSpec, OperationalTx);

OperationalETxSpec.prototype.getChangeAddress = function(colorDef) {
  return this.ewctrl.getNewAddress(colorDef)
}

OperationalETxSpec.prototype.setOurValueLimit = function(our){
  var our_colordef = this.ewctrl.resolveColorDesc(our['color_spec'])
  // TODO typeerror here?
  this.ourValueLimit = new ColorValue(our_colordef, our['value'])
}

OperationalETxSpec.prototype.prepareInputs = function(etx_spec, prepInptCB){
  var self = this
  self.inputs = {}
  async.map(Object.keys(etx_spec.inputs), function(colorDesc, colorDescCB){
    var colordef = self.ewctrl.resolveColorDesc(colorDesc)
    async.map(etx_spec.inputs[colorDesc], function(input, inputCB){
      var txhash = input[0]
      var outindex = input[1]

      self.ewctrl.wallet.getBlockchain().getTx(txhash).then(function(txHex){

        var tx = bitcoin.Transaction.fromHex(txHex)
        var output = tx.outs[outindex]
        var utxo = {
          "txhash": txhash,
          "outindex": outindex,
          "value": output.value,
          "script": output.script
        }
        if(colordef.getColorType() === "uncolored"){
          var colorValue = new ColorValue(colordef, output.value)
          self.addInput(colordef, colorValue, utxo)
        } else {
          var colordata = self.ewctrl.wallet.getColorData()
          colordata.getColorValue(txhash, outindex, colordef, function(e, cv){
            if(e){ throw e }
            self.addInput(colordef, cv, utxo)
          })
        }
        return null
      }).then(inputCB, inputCB)
    }, function(error){
      colorDescCB(error)
    })
  }, function(error){
    prepInptCB(error)
  })
}

OperationalETxSpec.prototype.addInput = function(colordef, colorValue, utxo){
  if(colorValue){
    if(!this.inputs[colordef.getColorId()]){
      this.inputs[colordef.getColorId()] = []
    }
    this.inputs[colordef.getColorId()].push([colorValue, utxo])
  }
}

OperationalETxSpec.prototype.prepareTargets = function(etxSpec, their){
  var self = this
  self.targets = []

  // add their targets
  etxSpec.targets.forEach(function(target){
    var address = target[0]
    var colorDesc = target[1]
    var value = target[2]
    var colordef = self.ewctrl.resolveColorDesc(colorDesc)
    var colorValue = new ColorValue(colordef, value)
    var targetScript = bitcoin.Address.fromBase58Check(address).toOutputScript()
    self.targets.push(new ColorTarget(targetScript.toHex(), colorValue))
  })

  // add our target
  var their_colordef = self.ewctrl.resolveColorDesc(their['color_spec'])
  var address = self.getChangeAddress(their_colordef)
  var targetScript = bitcoin.Address.fromBase58Check(address).toOutputScript()
  var cv = new ColorValue(their_colordef, their['value'])
  self.targets.push(new ColorTarget(targetScript.toHex(), cv))
}

OperationalETxSpec.prototype._selectUncoloredCoins = function (
    colorValue, feeEstimator, cb) {

  var self = this
  var selectedInputs = []
  var colordef = new UncoloredColorDefinition()
  var selectedValue = new ColorValue(colordef, 0)
  var requiredSum = colorValue
  /* FIXME use feeEstimator, where to get coins from?
  if(feeEstimator){ 
    requiredSum = requiredSum.plus(
        feeEstimator.estimateRequiredFee({extraTxIns: coins.length})
    )
  }
  */
  var colorId = 0
  if(colorId in self.inputs){
    var total = new ColorValue(colordef, 0)
    self.inputs[colorId].forEach(function(cv_u){
      total = total.plus(cv_u[0])
    })
    requiredSum = requiredSum.minus(total)
    self.inputs[colorId].forEach(function(cv_u){
      Array.prototype.push.apply(selectedInputs, cv_u[1])
    })
    selectedValue = selectedValue.plus(total)
  }
  if(requiredSum.getValue() > 0){
    var valueLimit = new ColorValue(colordef, 10000+8192*2) // padding
    if(self.ourValueLimit.isUncolored()){
      valueLimit = valueLimit.plus(self.ourValueLimit)
    }
    if(requiredSum.getValue() > valueLimit.getValue()){
      return cb(new Error("Exceeded limits: " + requiredSum.toString() + 
                          " requested, " + valueLimit.toString() + " found!"))
    }
    OperationalETxSpec.super_.prototype.selectCoins.apply(
      this, [
        colorValue.minus(selectedValue), feeEstimator, 
        function(error, ourInputs, ourValue){
          cb(null, selectedInputs.plus(ourInputs), selectedValue.plus(ourValue))
        }
      ]
    )
  } else {
    cb(null, selectedInputs, selectedValue)
  }
}

OperationalETxSpec.prototype.selectCoins = function (
    colorValue, feeEstimator, cb) {

  // TODO import verify
  // verify.ColorValue(colorValue)
  // if (feeEstimator !== null) { verify.object(feeEstimator) }
  // verify.function(cb)
  var self = this
  var colordef = colorValue.getColorDefinition()
  if(colorValue.isUncolored()){
    return self._selectUncoloredCoins(colorValue, feeEstimator, cb)
  }
  var colorId = colordef.getColorId()
  if(colorId in self.inputs){
    // use inputs provided in proposal
    var total = new ColorValue(colordef, 0)
    var utxos = []
    self.inputs[colorId].forEach(function(cv_u){ 
      total = total.plus(cv_u[0])
      utxos.push(cv_u[1])
    })
    if(total.getValue() < colorValue.getValue()){
      return cb(new Error('Not enough coins: ' + colorValue.toString() + 
                          ' requested, ' + total.toString() + ' found!'))
    }
    return cb(null, utxos, total)
  }
  if(colorValue.getValue() > self.ourValueLimit.getValue()){ 
    return cb(new Error(colorValue.toString() + " requested, " + 
                        self.ourValueLimit.toString() + "%s found!"))
  }
  OperationalETxSpec.super_.prototype.selectCoins.apply(
      this, [colorValue, feeEstimator, cb]
  )
}

/**
 * @class EWalletController
 */
function EWalletController(wallet, seedHex){
  this.wallet = wallet
  this.seedHex = seedHex
  this.neverSendOnPublishTx = false
  this.publishedTxLog = []
}

EWalletController.prototype.publishTX = function(raw_tx){
  this.publishedTxLog.push(raw_tx)
  if(this.neverSendOnPublishTx){
    return
  }
  var tx = raw_tx.toTransaction(false)
  this.wallet.sendTx(tx, function(error){
    if (error){ throw error }
  })
}

EWalletController.prototype.resolveColorDesc = function(colorDesc){
  return this.wallet.cdManager.resolveByDesc(colorDesc, true);
}

EWalletController.prototype.selectInputs = function(colorValue, cb){
  var optx = new OperationalTx(this.wallet)
  var colordef = colorValue.getColorDefinition()
  if(colorValue.isUncolored()){
    var feeEstimator = null // FIXME use feeEstimator
    optx.selectCoins(colorValue, feeEstimator, function(err, coins, total){
      if(err){
        cb(err)
      } else {

        var change = total.minus(colorValue)
        if(feeEstimator){
          change = change.minus(feeEstimator.estimateRequiredFee({
            extraTxIns: coins.length
          }))
        }
        if(change < optx.getDustThreshold()){
          var change = new ColorValue(new UncoloredColorDefinition(), 0)
        }
        cb(null, coins, change)
      }
    })
  } else {
    optx.selectCoins(colorValue, null, function(err, coins, total){
      if(err){
        cb(err)
      } else {
        var change = total.minus(colorValue)
        cb(err, coins, change)
      }
    })
  }
}

EWalletController.prototype.makeEtxSpec = function(our, their, cb){
  var self = this
  var inputs = {}
  var ourColorDef = self.resolveColorDesc(our['color_spec'])
  var theirColorDef = self.resolveColorDesc(their['color_spec'])
  var our_color_spec = our['color_spec']
  var extra_value = 0

  // tx fee (why only for btc?)
  if(ourColorDef.getColorType() === "uncolored"){
      // pay fee + padding for one colored outputs
      extra_value = 10000 + 8192 * 1
  }

  // get needed coins
  var colorValue = new ColorValue(ourColorDef, our['value'] + extra_value)
  self.selectInputs(colorValue, function(error, coins, change){
    if(error){ return cb(error) }

    // our inputs
    inputs[our_color_spec] = []
    coins.forEach(function(coin){
      inputs[our_color_spec].push([coin.txId, coin.outIndex])
    })

    // our receive address
    var address = self.getNewAddress(theirColorDef)
    var targets = [[address, their['color_spec'], their['value']]]

    // our change
    if(change.getValue() > 0){
      var address = self.getNewAddress(ourColorDef)
      targets.push([address, our_color_spec, change.getValue()])
    }

    cb(null, new ETxSpec(inputs, targets, coins))
  })
}

EWalletController.prototype.getNewAddress = function(colorDef){
  var adm = this.wallet.getAssetDefinitionManager()
  var assetDef = adm.getByDesc(colorDef.getDesc())
  return this.wallet.getNewAddress(this.getSeedHex(), assetDef)
}

EWalletController.prototype.makeReplyTx = function(etxSpec, our, their, cb){
  var self = this
  var opTxSpec = new OperationalETxSpec(self)
  opTxSpec.setOurValueLimit(our)
  opTxSpec.prepareInputs(etxSpec, function(error){ // adds their inputs to opTxSpec
    if(error){ return cb(error) }
    opTxSpec.prepareTargets(etxSpec, their)
    // FIXME what about OBColorDefinition ???
    EPOBCColorDefinition.makeComposedTx(opTxSpec, function (error, ctx) {
      if(error){ return cb(error) }
      self.wallet.transformTx(ctx, 'signed', self.seedHex, cb)
    });
  })
}

EWalletController.prototype.getSeedHex = function(){
  return this.seedHex
}

module.exports = {
  OperationalETxSpec: OperationalETxSpec,
  EWalletController: EWalletController
}

