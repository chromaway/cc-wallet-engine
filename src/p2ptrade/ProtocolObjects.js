var util = require('util')
var make_random_id = require('./Utils').make_random_id
var equal = require('deep-equal');
var WalletCore = require('cc-wallet-core');
var RawTx = WalletCore.tx.RawTx;
var unixTime = require('./Utils').unixTime


/**
 * A is the offer side's ColorValue
 * B is the replyer side's ColorValue
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
  return !!((!this.expires) || (this.expires < (unixTime() + shift)))
}

EOffer.prototype.refresh = function(delta){
  this.expires = unixTime() + delta
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
  var rtxs = RawTx.fromHex(reply_ep.etx_data)
  if(this.ewctrl.checkTx(rtxs, this.etx_spec)){
    var wallet = this.ewctrl.wallet
    var seedHex = this.ewctrl.getSeedHex()
    var cb = function(error){
      if(error){
        throw Error("Sign raw tx failed!")
      }
    }
    rtxs.sign(wallet, seedHex, cb)
    this.ewctrl.publish_tx(rtxs, this.my_offer) 
    this.etx_data = rtxs.toHex(false)
  } else {
    throw new Error("p2ptrade reply tx check failed")
  }
}


/**
 * @class MyReplyEProposal
 */
function MyReplyEProposal(ewctrl, foreign_ep, my_offer){
  EProposal.apply(this, [foreign_ep.pid, ewctrl, foreign_ep.offer])
  this.my_offer = my_offer
  this.tx = this.ewctrl.make_reply_tx(
      foreign_ep.etx_spec, my_offer.A, my_offer.B
  )
}

util.inherits(MyReplyEProposal, EProposal)

MyReplyEProposal.prototype.get_data = function(){
  var data = EProposal.prototype.get_data.apply(this)
  data['etx_data'] = this.tx.toHex()
  return data
}

MyReplyEProposal.prototype.process_reply = function(reply_ep){
  var rtxs = RawTx.fromHex(reply_ep.etx_data)
  this.ewctrl.publish_tx(rtxs, this.my_offer)
}


/**
 * @class ForeignEProposal
 */
function ForeignEProposal(ewctrl, ep_data){
  var offer = EOffer.from_data(ep_data['offer'])
  EProposal.apply(this, [ep_data['pid'], ewctrl, offer])
  this.etx_spec = undefined
  if('etx_spec' in ep_data){
    this.etx_spec = ETxSpec.from_data(ep_data['etx_spec'])
  }
  this.etx_data = ep_data['etx_data']
}

util.inherits(ForeignEProposal, EProposal)

ForeignEProposal.prototype.accept = function(my_offer){
  if(!this.offer.is_same_as_mine(my_offer)){
    throw new Error("incompatible offer")
  }
  if(!this.etx_spec){
    throw new Error("need etx_spec")
  }
  return new MyReplyEProposal(this.ewctrl, this, my_offer)
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
