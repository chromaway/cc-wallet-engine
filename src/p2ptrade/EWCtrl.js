var util = require('util')


/**
 * @class OperationalETxSpec
 */
function OperationalETxSpec(model, ewctrl){
  // TODO implement
  throw new Error("Not implemented!")
}

// TODO util.inherits(OperationalETxSpec, SimpleOperationalTxSpec)

OperationalETxSpec.prototype.get_targets = function(){
  // TODO implement
  throw new Error("Not implemented!")
}

OperationalETxSpec.prototype.get_change_addr = function(color_def){
  // TODO implement
  throw new Error("Not implemented!")
}

OperationalETxSpec.prototype.set_our_value_limit = function(our){
  // TODO implement
  throw new Error("Not implemented!")
}

OperationalETxSpec.prototype.prepare_inputs = function(etx_spec){
  // TODO implement
  throw new Error("Not implemented!")
}

OperationalETxSpec.prototype.prepare_targets = function(etx_spec, their){
  // TODO implement
  throw new Error("Not implemented!")
}

OperationalETxSpec.prototype.select_uncolored_coins = function(
    colorvalue, use_fee_estimator
  ){

  // TODO implement
  throw new Error("Not implemented!")
}

OperationalETxSpec.prototype.select_coins = function(
    colorvalue, use_fee_estimator
  ){

  // TODO implement
  throw new Error("Not implemented!")
}



/**
 * @class EWalletController
 */
function EWalletController(wallet){
  this.wallet = wallet
}

EWalletController.prototype.publish_tx = function(raw_tx, my_offer){
  // TODO implement
  throw new Error("Not implemented!")
}

EWalletController.prototype.check_tx = function(raw_tx, etx_spec){
  // TODO implement
  throw new Error("Not implemented!")
}

EWalletController.prototype.resolve_color_spec = function(color_spec){
  // TODO implement
  throw new Error("Not implemented!")
}

EWalletController.prototype.offer_side_to_colorvalue = function(side){
  // TODO implement
  throw new Error("Not implemented!")
}

EWalletController.prototype.select_inputs = function(colorvalue){
  // TODO implement
  throw new Error("Not implemented!")
}

EWalletController.prototype.make_etx_spec = function(our, their){
  // TODO implement
  throw new Error("Not implemented!")
}

EWalletController.prototype.make_reply_tx = function(etx_spec, our, their){
  // TODO implement
  throw new Error("Not implemented!")
}


module.exports = {
  OperationalETxSpec: OperationalETxSpec,
  EWalletController: EWalletController
}

