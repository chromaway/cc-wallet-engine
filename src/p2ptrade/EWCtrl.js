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

// TODO color_spec -> colorDesc

/**
 * @class OperationalETxSpec
 */
function OperationalETxSpec(ewctrl){
  OperationalTx.apply(this, [ewctrl.wallet])
  this.ewctrl = ewctrl
  this.our_value_limit = undefined
}

util.inherits(OperationalETxSpec, OperationalTx);

OperationalETxSpec.prototype.get_targets = function(){
  return OperationalTx.prototype.getTargets.call(this)
}

OperationalETxSpec.prototype.getChangeAddress = function(colorDef) {
  return this.ewctrl.getNewAddress(colorDef)
}

OperationalETxSpec.prototype.set_our_value_limit = function(our){
  our_colordef = this.ewctrl.resolve_color_spec(our['color_spec'])
  this.our_value_limit = new ColorValue(our_colordef, our['value'])
}

OperationalETxSpec.prototype.prepareInputs = function(etx_spec, main_cb){
  var self = this
  self.inputs = {}

  async.map(Object.keys(etx_spec.inputs), function(color_spec, spec_cb){
    var colordef = self.ewctrl.resolve_color_spec(color_spec)
    async.map(etx_spec.inputs[color_spec], function(inp, inp_cb){

      var txhash = inp[0]
      var outindex = inp[1]
      var tx =  self.ewctrl.wallet.getStateManager().getTx(txhash)
      var prevout = tx.outs[outindex]
      var utxo = {
        "txhash": txhash,
        "outindex": outindex,
        "value": prevout.value,
        "script": prevout.script
      }
      if(colordef.getColorType() === "uncolored"){
        var colorvalue = new ColorValue(colordef, prevout.value)
        self.addInput(colordef, colorvalue, utxo)
        inp_cb(null)
      } else {
        var colordata = self.ewctrl.wallet.getColorData()
        colordata.getColorValue(txhash, outindex, colordef, function(e, cv){
          if(e){ return inp_cb(e) }
          self.addInput(colordef, cv, utxo)
          inp_cb(null)
        })
      }

    }, function(error){
      spec_cb(error)
    })
  }, function(error){
    main_cb(error)
  })
}

OperationalETxSpec.prototype.addInput = function(colordef, colorvalue, utxo){
  if(colorvalue){
    if(!this.inputs[colordef.getColorId()]){
      this.inputs[colordef.getColorId()] = []
    }
    this.inputs[colordef.getColorId()].push([colorvalue, utxo])
  }
}

OperationalETxSpec.prototype.prepareTargets = function(etxSpec, their){
  var self = this
  self.targets = []

  // add their targets
  etxSpec.targets.forEach(function(target){
    var address = target[0]
    var color_spec = target[1]
    var value = target[2]
    var colordef = self.ewctrl.resolve_color_spec(color_spec)
    var colorvalue = new ColorValue(colordef, value)
    var targetScript = bitcoin.Address.fromBase58Check(address).toOutputScript()
    self.targets.push(new ColorTarget(targetScript.toHex(), colorvalue))
  })

  // add our target
  var their_colordef = self.ewctrl.resolve_color_spec(their['color_spec'])
  var address = self.getChangeAddress(their_colordef)
  var targetScript = bitcoin.Address.fromBase58Check(address).toOutputScript()
  var cv = new ColorValue(their_colordef, their['value'])
  self.targets.push(new ColorTarget(targetScript.toHex(), cv))
}

/*
OperationalETxSpec.prototype.selectUncoloredCoins = function( // FIXME unneeded?
      colorvalue, feeEstimator, cb
    ){
  var uncoloredColorDef = new UncoloredColorDefinition()
  var zero = new ColorValue(uncoloredColorDef, 0)
  var selected_inputs = []
  var selected_value = zero.clone()
  var needed = zero.clone()

  // add fee
  if(feeEstimator){
    // FIXME give feeEstimator required args!
    needed = colorvalue.plus(feeEstimator.estimateRequiredFee())
  } else {
    needed = colorvalue
  }

  var color_id = 0
  if(color_id in this.inputs){

    var inputs = this.inputs[color_id]
    var total = zero.clone()
    inputs.foreach(function(input){
      total = total.plus(input[0])
    })

    needed = needed.minus(total)
    inputs.foreach(function(input){
      selected_inputs.push(input[1])
    })
    selected_value = selected_value.plus(total)
  }
  if(needed.getValue() > 0){
    var value_limit = new ColorValue(uncoloredColorDef, 10000+8192*2)
    if(this.our_value_limit.isUncolored()){
      value_limit = value_limit.plus(this.our_value_limit)
    }
    if(needed.getValue() > value_limit.getValue()){
      return cb(new Error(
          "Insufficient Funds, exceeded limits: " + needed +
          " requested, " + value_limit + " found" % (needed, value_limit)
      ))
    }
    var needed = colorvalue.minus(selected_value)
    OperationalTx.prototype.selectCoins.call(this, needed, feeEstimator,
      function (err, coins, value){
        selected_value = selected_value.plus(value)
        coins.forEach(function(coin){
          selected_inputs.push(coin)
        })
        cb(null, selected_inputs, selected_value)
      }
    )
  } else {
    cb(null, selected_inputs, selected_value)
  }
}

OperationalETxSpec.prototype.selectCoins = function(colorValue, feeEstimator, cb){ // FIXME unneeded?
  //self._validate_select_coins_parameters(colorValue, feeEstimator)
  var colordef = colorValue.getColorDefinition()
  var color_id = colordef.getColorId()
  var zero = new ColorValue(colordef, 0)

  if(colordef.getColorType() === "uncolored"){
    return this.selectUncoloredCoins(colorValue, feeEstimator, cb)
  }

  if(color_id in this.inputs){
    var inputs = this.inputs[color_id]
    var total = zero.clone()
    inputs.forEach(function(input){
      total = total.plus(input[0])
    })
    if(total.getValue() < colorValue.getValue()){
      return cb(new Error(
        "Insufficient funds, not enough coins: " + colorValue +
        " requested, " + total + " found"
      ))
    }
    var coins = []
    inputs.forEach(function(input){
      coins.push(input[1])
    })
    return cb(null, coins, total)
  }
  if(colorValue.getValue() > this.our_value_limit.getValue()){
    return cb(new Error(
      "Insufficient funds " + colorValue + " requested, " +
      this.our_value_limit + " found"
    ))
  }
  OperationalTx.prototype.selectCoins(this, colorValue, feeEstimator, cb)
}
*/

/**
 * @class EWalletController
 */
function EWalletController(wallet, seedHex){
  this.wallet = wallet
  this.seedHex = seedHex
}

EWalletController.prototype.publish_tx = function(raw_tx, my_offer){

  // add to history
  // TODO history trade entry not implemented ?
  // this.wallet.historyManager

  // txhash = raw_tx.get_hex_txhash()
  // self.model.tx_history.add_trade_entry(
  //     txhash,
  //     self.offer_side_to_colorvalue(my_offer.B),
  //     self.offer_side_to_colorvalue(my_offer.A))

  // publish transaction
  var published = true
  var tx = raw_tx.toTransaction(false)
  this.wallet.sendTx(tx, function(err){
    if (err){
      published = false
    }
  })
  return published
}



/**
 * Check if raw tx satisfies spec's targets.
 * @param src_etx_spec: from MyEProposal
 * @param raw_tx: from ForeignEProposal
 */
EWalletController.prototype._checkTx = function(raw_tx, src_etx_spec){
  /*
  var self = this

  var bctx = bitcoin.core.CTransaction.deserialize(raw_tx.get_tx_data())
  var txhash = raw_tx.get_hex_txhash()
  var blockchain_state = self.model.ccc.blockchain_state
  var ctx = CTransaction.from_bitcoincore(txhash, bctx, blockchain_state)

  var src_tragets = []
  var src_color_id_set = new Set([])
  var used_outputs = new Set([])
  var satisfied_src_targets = new Set([])

  // populate src_tragets and src_color_id_set
  src_etx_spec.targets.forEach(function (target) {
    var raw_addr = CBitcoinAddress(target[0])
    var src_color_id = self.resolve_color_spec(target[0]).get_color_id()
    src_color_id_set.add(src_color_id)
    src_tragets.push([raw_addr, src_color_id, target[2]])
  }

  // find satisfied colored coin targets
  src_color_id_set.get().forEach(function (src_color_id){
    if(src_color_id == 0){
      return // skip uncolored
    }
    var out_colorvalues = self.model.ccc.colordata.get_colorvalues_raw(src_color_id, ctx)
    for(oi = 0; oi < ctx.outputs.length; oi++){
      if(used_outputs.contains(oi)){
        return // skip used outputs
      }
      if(out_colorvalues[oi]){
        src_tragets.forEach(function (target){
          if(satisfied_src_targets.contains(target)){
            return // skip already satisfied
          }
          var raw_address = target[0]
          var tgt_color_id = target[1]
          var value = target[2]
          if((tgt_color_id == src_color_id) &&
             (value == out_colorvalues[oi].get_value()) &&
             (raw_address == ctx.outputs[oi].raw_address)){
            satisfied_src_targets.add(target)
            used_outputs.add(oi)
          }
        }
      }
    }
  }

  // find satisfied uncolored coin targets
  src_tragets.forEach(function (target){
    raw_address = target[0]
    tgt_color_id = target[1]
    value = target[2]
    if(tgt_color_id != 0){
      return // skip colored outputs
    }
    if(satisfied_src_targets.contains(target)){
      return // skip already satisfied
    }
    for(oi = 0; oi < ctx.outputs.length; oi++){
      if(used_outputs.contains(oi)){
        continue // skip used outputs
      }
      if((value == ctx.outputs[oi].value) &&
         (raw_address == ctx.outputs[oi].raw_address)){
        satisfied_src_targets.add(target)
        used_outputs.add(oi)
      }
    }
  }
  return src_tragets.length == satisfied_src_targets.size
  */
}

EWalletController.prototype.resolve_color_spec = function(color_spec){
  return this.wallet.cdManager.resolveByDesc(color_spec, true);
}

EWalletController.prototype.offer_side_to_colorvalue = function(side){
  var colordef = this.resolve_color_spec(side['color_spec'])
  return new ColorValue(colordef, side['value'])
}

EWalletController.prototype.selectInputs = function(colorvalue, cb){
  var optx = new OperationalTx(this.wallet)
  var colordef = colorvalue.getColorDefinition()
  if(colorvalue.isUncolored()){
    var feeEstimator = null // FIXME use feeEstimator
    optx.selectCoins(colorvalue, feeEstimator, function(err, coins, total){
      if(err){
        cb(err)
      } else {

        var change = total.minus(colorvalue)
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
    optx.selectCoins(colorvalue, null, function(err, coins, total){
      if(err){
        cb(err)
      } else {
        var change = total.minus(colorvalue)
        cb(err, coins, change)
      }
    })
  }
}

EWalletController.prototype.makeEtxSpec = function(our, their, cb){
  var self = this
  var inputs = {}
  var ourColorDef = self.resolve_color_spec(our['color_spec'])
  var theirColorDef = self.resolve_color_spec(their['color_spec'])
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
      targets.push([address, our_color_spec, change.get_value()])
    }

    cb(null, new ETxSpec(inputs, targets, coins))
  })
}

EWalletController.prototype.getNewAddress = function(colorDef){
  return this.wallet.getNewAddress(this.getSeedHex(), colorDef)
}

EWalletController.prototype.makeReplyTx = function(etxSpec, our, their, cb){
  var self = this
  var opTxSpec = new OperationalETxSpec(self)
  opTxSpec.set_our_value_limit(our)
  opTxSpec.prepareInputs(etxSpec, function(error){ // adds their inputs to opTxSpec
    if(error){ return cb(error) }
    opTxSpec.prepareTargets(etxSpec, their)
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

