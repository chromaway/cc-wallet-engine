var Q = require('q')
var util = require('util')
var WalletCore = require('cc-wallet-core')
var OperationalTx = WalletCore.tx.OperationalTx
var ColorValue = WalletCore.cclib.ColorValue
var EPOBCColorDefinition = WalletCore.cclib.EPOBCColorDefinition;
var UncoloredColorDefinition = WalletCore.cclib.UncoloredColorDefinition
var Set = require('set')

var bitcoin = WalletCore.bitcoin

// TODO color_spec -> colorDesc

/**
 * @class OperationalETxSpec
 */
function OperationalETxSpec(ewctrl){
  OperationalTx.call(this)
  this.ewctrl = ewctrl
  this.our_value_limit = undefined
}

util.inherits(OperationalETxSpec, OperationalTx);

OperationalETxSpec.prototype.get_targets = function(){
  return OperationalTx.prototype.getTargets.call(this)
}

OperationalETxSpec.prototype.getChangeAddress = function(colordef) {
  var seedHex = ewctrl.getSeedHex()
  return this.ewctrl.wallet.getNewAddress(seedHex, colordef)
}

OperationalETxSpec.prototype.get_change_address = function(colordef){
  return this.getChangeAddress(colordef)
}

OperationalETxSpec.prototype.set_our_value_limit = function(our){
  our_colordef = this.ewctrl.resolve_color_spec(our['color_spec'])
  this.our_value_limit = new ColorValue(our_colordef, our['value'])
}

OperationalETxSpec.prototype.prepare_inputs = function(etx_spec){
  this.inputs = {}
  for (var color_spec in etx_spec.inputs) {
    var inps = etx_spec.inputs[key]
    var colordef = this.ewctrl.resolve_color_spec(color_spec)
    for(i = 0; i < inps.length; i++){
      var inp = inps[i]
      var txhash = inp[0]
      var outindex = inp[1]
      var tx = this.ewctrl.wallet.txDb.getTx(txhash)
      var prevout = tx.outs[outindex]
      var utxo = {
        "txhash": txhash,
        "outindex": outindex,
        "value": prevout.value,
        "script": prevout.script
      }
      var colorvalue = null
      if(colordef.getColorType() === "uncolored"){
        colorvalue = new ColorValue(colordef, prevout.value)
      } else {
        var colordata = this.ewctrl.wallet.getColorData()
        colordata.getColorValue(txhash, outindex, colordef, function(e, cv){
          colorvalue = cv
        })
      }
      if(colorvalue){
        if(!this.inputs[colordef.getColorId()]){
          this.inputs[colordef.getColorId()] = []
        }
        this.inputs[colordef.getColorId()].push([colorvalue, utxo])
      }
    }
  }
}

OperationalETxSpec.prototype.prepare_targets = function(etx_spec, their){
  this.targets = []
  for(i = 0; i < etx_spec.targets.length; i++){
    var address = etx_spec.targets[i][0]
    var color_spec = etx_spec.targets[i][0]
    var value = etx_spec.targets[i][0]
    var colordef = this.ewctrl.resolve_color_spec(color_spec)
    var colorvalue = new ColorValue(colordef, value)
    var targetScript = bitcoin.Address.fromBase58Check(address).toOutputScript()
    this.targets.push(new ColorTarget(targetScript.toHex(), colorvalue))
  }
  var their_colordef = this.ewctrl.resolve_color_spec(their['color_spec'])
  var address = this.getChangeAddress(colordef)
  var targetScript = bitcoin.Address.fromBase58Check(address).toOutputScript()
  var cv = new ColorValue(their_colordef, their['value'])
  this.targets.push(new ColorTarget(targetScript.toHex(), cv))
}

OperationalETxSpec.prototype.select_uncolored_coins = function(
      colorvalue, feeEstimator
    ){
  var zero = new ColorValue(new UncoloredColorDefinition(), 0)
  var selected_inputs = []
  var selected_value = zero.clone()
  var needed = zero.clone()
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
    for(i=0; i < inputs.length; i++){
      total = total.plus(inputs[i][0])
    }
    needed = needed.minus(total)
    for(i=0; i < inputs.length; i++){
      selected_inputs.push(inputs[i][1])
    }
    selected_value = selected_value.plus(total)
  }
  if(needed.getValue() > 0){
    var value_limit = new ColorValue(
        new UncoloredColorDefinition(), 10000+8192*2
    )
    if(this.our_value_limit.isUncolored()){
      value_limit = value_limit.plus(this.our_value_limit)
    }
    if(needed.getValue() > value_limit.getValue()){
      throw new Error(
          "Insufficient Funds, exceeded limits: " + needed +
          " requested, " + value_limit + " found" % (needed, value_limit)
      )
    }
    OperationalTx.prototype.selectCoins.call(
        this, colorvalue.minus(selected_value), feeEstimator,
        function (err, coins, value){
          selected_value = selected_value.plus(value)
          for(i=0; i < coins.length; i++){
            selected_inputs.push(coins[i])
          }
        }
    )
  }
  return [selected_inputs, selected_value]
}

OperationalETxSpec.prototype.selectCoins = function(colorValue, feeEstimator, cb){
  //self._validate_select_coins_parameters(colorValue, feeEstimator)
  colordef = colorValue.getColorDefinition()
  if(colordef.getColorType() === "uncolored"){
    var data = this.select_uncolored_coins(colorValue, feeEstimator)
    cb(null, data[0], data[1])
    return undefined
  }
  color_id = colordef.getColorId()
  if(color_id in this.inputs){
    var inputs = this.inputs[color_id]
    var total = zero.clone()
    for(i=0; i < inputs.length; i++){
      total = total.plus(inputs[i][0])
    }
    if(total.getValue() < colorValue.getValue()){
      var err = (
          "Insufficient funds, not enough coins: " + colorValue +
          " requested, " + total + " found"
      )
      cb(err, undefined, undefined)
      return undefined
    }

    var coins = []
    for(i=0; i < inputs.length; i++){
      coins.push(inputs[i][1])
    }
    cb(null, coins, total)
    return undefined
  }
  if(colorValue.getValue() > this.our_value_limit.getValue()){
    var err = (
        "Insufficient funds " + colorValue + " requested, " +
        this.our_value_limit + " found"
    )
    cb(err, undefined, undefined)
    return undefined
  }
  OperationalTx.prototype.selectCoins(this, colorValue, feeEstimator, cb)
}

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
  var our_color_def = self.resolve_color_spec(our['color_spec'])
  var their_color_def = self.resolve_color_spec(their['color_spec'])
  var extra_value = 0
  if(colordef.getColorType() === "uncolored"){
      // pay fee + padding for one colored outputs
      extra_value = 10000 + 8192 * 1
  }
  var colorValue = new ColorValue(our_color_def, our['value'] + extra_value)
  Q.ninvoke(self, 'selectInputs', colorValue).then(function (coins, change) {
    var our_color_spec = our['color_spec']
    var inputs = {our_color_spec: []}
    coins.forEach(function(coin){
      inputs[our_color_spec].push([coin.txId, coin.outIndex])
    })
    var address = self.getChangeAddress(our_color_def).get_address()
    var spec = their['color_spec']
    var targets = [[address, spec, their['value']]]
    if(change.getValue() > 0){
      var address = self.getChangeAddress(our_color_def).get_address()
      targets.push([address, our_color_spec, change.get_value()])
    }
    return new ETxSpec(inputs, targets, coins)
  }).done(
    function (etxSpec) { cb(null, etxSpec) },
    function (error) { cb(error) }
  )
}

EWalletController.prototype.make_reply_tx = function(etx_spec, our, their){
  var self = this
  var signed_tx = null
  var op_tx_spec = new OperationalETxSpec(this)
  op_tx_spec.set_our_value_limit(our)
  op_tx_spec.prepare_inputs(ext_spec)
  op_tx_spec.prepare_targets(etx_spec, their)
  EPOBCColorDefinition.makeComposedTx(op_tx_spec, function (err, ctx) {
    if(!err){
      self.wallet.transformTx(ctx, 'signed', this.seedHex, function(err, stx){
        if(!err){
          signed_tx = stx
        }
      })
    }
  });
  return signed_tx
}

EWalletController.prototype.getSeedHex = function(){
  return this.seedHex
}


module.exports = {
  OperationalETxSpec: OperationalETxSpec,
  EWalletController: EWalletController
}

