var util = require('util')
var make_random_id = require('./Utils').make_random_id
var equal = require('deep-equal');


/**
 * @class EOffer
 */
function EOffer(oid, A, B){
  if (oid){
    this.oid = oid
  } else {
    this.oid = make_random_id()
  }
  this.A = A
  this.B = B
  this.expires = null
}

EOffer.prototype.expired = function(){
  return this.expired_shift(0)
}

EOffer.prototype.expired_shift = function(shift){
  var date = new Date()
  var seconds = date.getTime() / 1000
  return !!((!this.expires) || (this.expires < (seconds + shift)))
}

EOffer.prototype.refresh = function(delta){
  var date = new Date()
  var seconds = date.getTime() / 1000
  this.expires = seconds + delta
}

EOffer.prototype.is_same_as_mine = function(my_offer){
  return equal(this.A, my_offer.A) && equal(this.B, my_offer.B)
}

EOffer.prototype.matches = function(offer){
  return equal(this.A, offer.B) && equal(offer.A, this.B)
}

EOffer.prototype.get_data = function(){
  return {oid: this.oid, A: this.A, B: this.B}
}

EOffer.from_data = function(data){
  return new EOffer(data['oid'], data['A'], data['B'])
}


/**
 * @class MyEOffer
 */
function MyEOffer(){
  EOffer.apply(this, Array.prototype.slice.call(arguments))
  this.auto_post = true
}

util.inherits(MyEOffer, EOffer)

MyEOffer.from_data = function(data){
  return new MyEOffer(data['oid'], data['A'], data['B'])
}


/**
 * @class ETxSpec
 */
function ETxSpec(inputs, targets, my_utxo_list){
  this.inputs = inputs
  this.targets = targets
  this.my_utxo_list = my_utxo_list
}

ETxSpec.prototype.get_data = function(){
  return {inputs:this.inputs, targets:this.targets}
}

ETxSpec.from_data = function(data){
  return new ETxSpec(data['inputs'], data['targets'], null)
}


/**
 * @class EProposal
 */
function EProposal(pid, ewctrl, offer){
  this.pid = pid
  this.ewctrl = ewctrl
  this.offer = offer
}

EProposal.prototype.get_data = function(){
  return {pid:this.pid, offer:this.offer.get_data()}
}

/**
 * @class MyEProposal
 */
function MyEProposal(ewctrl, orig_offer, my_offer){
  EProposal.apply(this, [make_random_id(), ewctrl, orig_offer])
  this.my_offer = my_offer
  if(!orig_offer.matches(my_offer)){
    throw new Error("offers are incongruent")
  }
  this.etx_spec = ewctrl.make_etx_spec(this.offer.B, this.offer.A)
  this.etx_data = undefined
}

util.inherits(MyEProposal, EProposal)

MyEProposal.prototype.get_data = function(){
  var res = EProposal.prototype.get_data.call(this)
  if(this.etx_data){
    res["etx_data"] = this.etx_data
  } else {
    res["etx_spec"] = this.etx_spec.get_data()
  }
  return res
}

MyEProposal.prototype.process_reply = function(reply_ep){
  var rtxs = new RawTxSpec.from_tx_data(
      this.ewctrl.model, reply_ep.etx_data.decode('hex')
  )
  if(this.ewctrl.check_tx(rtxs, this.etx_spec)){
    rtxs.sign(this.etx_spec.my_utxo_list)
    this.ewctrl.publish_tx(rtxs, this.my_offer) 
    this.etx_data = rtxs.get_hex_tx_data()
  } else {
    throw new Error("p2ptrade reply tx check failed")
  }
}


/**
 * @class MyReplyEProposal
 */
function MyReplyEProposal(){
  // TODO implement
}


/**
 * @class ForeignEProposal
 */
function ForeignEProposal(){
  // TODO implement
}


module.exports = {
  EOffer: EOffer,
  MyEOffer: MyEOffer,
  ETxSpec: ETxSpec,
  EProposal: EProposal,
  MyEProposal: MyEProposal,
  MyReplyEProposal: MyReplyEProposal,
  ForeignEProposal: ForeignEProposal
}
