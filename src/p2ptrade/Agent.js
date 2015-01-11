var Q = require('q')
var assert = require('assert')
var dictValues = require('./Utils').dictValues
var unixTime = require('./Utils').unixTime
var MyEProposal = require('./ProtocolObjects').MyEProposal
var ForeignEProposal = require('./ProtocolObjects').ForeignEProposal

/**
 * Implements high-level exchange logic
 * Keeps track of the state (offers, propsals)
 * @class EAgent
 */
function EAgent(ewctrl, config, comm){
  this.ewctrl = ewctrl
  this.my_offers = {}
  this.their_offers = {}
  this.active_ep = null
  this.ep_timeout = null
  this.comm = comm
  this.offers_updated = false
  this.config = config
  this.event_handlers = {}
  this.comm.addAgent(this)
}

EAgent.prototype.set_event_handler = function(event_type, handler){
  this.event_handlers[event_type] = handler
}

EAgent.prototype.fire_event = function(event_type, data){
  var eh = this.event_handlers[event_type]
  if(eh){
    eh(data)
  }
}

EAgent.prototype.set_active_ep = function(ep){
  if(!ep){
    this.ep_timeout = null
  } else {
    var interval = this.config['ep_expiry_interval'] 
    this.ep_timeout = unixTime() + interval
  }
  this.active_ep = ep
}

EAgent.prototype.has_active_ep = function(){
  if(this.ep_timeout && this.ep_timeout < unixTime()){
    this.set_active_ep(null)
  }
  return !!this.active_ep
}

EAgent.prototype.service_my_offers = function(){
  var self = this
  var my_offers_values = []
  dictValues(self.my_offers).forEach(function (my_offer){
    if(my_offer.auto_post){
      if(!my_offer.expired()){
        return
      }
      if(self.active_ep && self.active_ep.my_offer.oid == my_offer.oid){
        return
      }
      my_offer.refresh(self.config['offer_expiry_interval'])
      self.post_message(my_offer)
    }
  })
}

EAgent.prototype.service_their_offers = function(){
  var self = this
  var their_offers_values = []
  dictValues(self.their_offers).forEach(function (their_offer) {
    var interval = self.config['offer_grace_interval']
    if(their_offer.expired_shift((!!interval) ? (-interval) : 0)){
      delete self.their_offers[their_offer.oid]
      self.fire_event('offers_updated', null)
    }
  })
}

EAgent.prototype.register_my_offer = function(offer){
  this.my_offers[offer.oid] = offer
  this.offers_updated = true
  this.fire_event('offers_updated', offer)
  this.fire_event('register_my_offer', offer)
}

EAgent.prototype.cancel_my_offer = function(offer){
  if(this.active_ep && (
        this.active_ep.offer.oid == offer.oid || 
        this.active_ep.my_offer.oid == offer.oid)
      ){
    this.set_active_ep(null)
  }
  if(offer.oid in this.my_offers){
    delete this.my_offers[offer.oid]
  }
  this.fire_event('offers_updated', offer)
  this.fire_event('cancel_my_offer', offer)
}

EAgent.prototype.register_their_offer = function(offer){
  this.their_offers[offer.oid] = offer
  offer.refresh(this.config['offer_expiry_interval'])
  this.offers_updated = true
  this.fire_event('offers_updated', offer)
}

EAgent.prototype.match_offers = function(){
  var self = this
  if(self.has_active_ep()){
    return false
  }
  var success = false
  dictValues(self.my_offers).forEach(function (my_offer) {
    dictValues(self.their_offers).forEach(function(their_offer){
      if(!success && my_offer.matches(their_offer)){
        self.makeExchangeProposal(their_offer, my_offer, function(error, ep){
          // FIXME handle error
        })
        success = true
      }
    })
  })
  return success
}

EAgent.prototype.makeExchangeProposal = function(orig_offer, my_offer, cb){
  var self = this
  if(self.has_active_ep()){
    return cb("Already have active exchange proposal!")
  }
  var our = orig_offer.B
  var their = orig_offer.A
  self.ewctrl.makeEtxSpec(our, their, function(error, etxSpec){
    if(error){ return cb(error) }
    var ep = new MyEProposal(self.ewctrl, orig_offer, my_offer, etxSpec)
    self.set_active_ep(ep)
    self.post_message(ep)
    self.fire_event('make_ep', ep)
    cb(null, ep)
  })
}

EAgent.prototype.dispatchExchangeProposal = function(ep_data, cb){
  var ep = new ForeignEProposal(this.ewctrl, ep_data)
  if(this.has_active_ep()){
    if(ep.pid == this.active_ep.pid){
      this.update_exchange_proposal(ep) // FIXME add cb
      return cb(null)
    }
  } else {
    if(ep.offer.oid in this.my_offers && !this.has_active_ep()){
      this.acceptExchangeProposal(ep, cb)
      return
    }
  }
  // We have neither an offer nor a proposal matching
  //  this ExchangeProposal
  if(ep.offer.oid in this.their_offers){
    // remove offer if it is in-work
    delete this.their_offers[ep.offer.oid]
  }
  cb(null)
}

EAgent.prototype.isValidInitialForeignExchangeProposal = function(ep, my_offer){
  // FIXME implement
  return true
}

EAgent.prototype.isValidForeignExchangeProposalReply = function(foreign_ep, my_ep){
  // FIXME implement
  return true
}

EAgent.prototype.acceptExchangeProposal = function(ep, cb){
  var self = this
  var my_offer = self.my_offers[ep.offer.oid]
  if(!self.isValidInitialForeignExchangeProposal(ep, my_offer)){
    // FIXME handle invalid foreign ep
    cb("invalid initial foreign exchange proposal")
  }
  ep.accept(my_offer, function(error, replyEP){
    if(error){ return cb(error) }
    self.set_active_ep(replyEP)
    self.post_message(replyEP)
    self.fire_event('accept_ep', [ep, replyEP])
    cb(null)
  })
}

EAgent.prototype.clear_orders = function(ep){
  this.fire_event('trade_complete', ep)
  if(ep instanceof MyEProposal){
    if(ep.my_offer){
      delete this.my_offers[ep.my_offer.oid]
    }
    delete this.their_offers[ep.offer.oid]
  } else {
    delete this.my_offers[ep.offer.oid]
  }
  this.fire_event('offers_updated', null)
}

/** 
 * TODO rename ot finishExchange
 */
EAgent.prototype.update_exchange_proposal = function(ep){
  var my_ep = this.active_ep
  if(!this.isValidForeignExchangeProposalReply(ep, my_ep)){
    // FIXME handle invalid ep reply
    return false
  }
  my_ep.process_reply(ep)
  if(my_ep instanceof MyEProposal){
    this.post_message(my_ep)
  }
  this.clear_orders(my_ep)
  this.set_active_ep(null)
  return true
}

EAgent.prototype.post_message = function(obj){
  this.comm.post_message(obj.get_data())
}

EAgent.prototype.dispatch_message = function(content){
  if('oid' in content){
    this.register_their_offer(EOffer.from_data(content))
  } else if('pid' in content){
    this.dispatchExchangeProposal(content, function(error){
      // TODO handle error?
    })
  }
}

EAgent.prototype.update = function(){
  this.comm.poll_and_dispatch()
  if(!this.has_active_ep() && this.offers_updated){
    this.offers_updated = false
    this.match_offers()
  }
  this.service_my_offers()
  this.service_their_offers()
}

module.exports = {
  EAgent: EAgent
}
