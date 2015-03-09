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
  this.myOffers = {}
  this.theirOffers = {}
  this.activeEP = null
  this.epTimeout = null
  this.comm = comm
  this.offersUpdated = false
  this.config = config
  this.eventHandlers = {}
  this.comm.addAgent(this)
}

EAgent.prototype.setEventHandler = function(event_type, handler){
  this.eventHandlers[event_type] = handler
}

EAgent.prototype.fireEvent = function(event_type, data){
  var eh = this.eventHandlers[event_type]
  if(eh){
    eh(data)
  }
}

EAgent.prototype.setActiveEP = function(ep){
  if(!ep){
    this.epTimeout = null
  } else {
    var interval = this.config['ep_expiry_interval'] 
    this.epTimeout = unixTime() + interval
  }
  this.activeEP = ep
}

EAgent.prototype.hasActiveEP = function(){
  if(this.epTimeout && this.epTimeout < unixTime()){
    this.setActiveEP(null)
  }
  return !!this.activeEP
}

EAgent.prototype.serviceMyOffers = function(){
  var self = this
  var my_offers_values = []
  dictValues(self.myOffers).forEach(function (my_offer){
    if(!my_offer.expired()){
      return
    }
    if(self.activeEP && self.activeEP.my_offer.oid == my_offer.oid){
      return
    }
    my_offer.refresh(self.config['offer_expiry_interval'])
    self.postMessage(my_offer)
  })
}

EAgent.prototype.serviceTheirOffers = function(){
  var self = this
  var their_offers_values = []
  dictValues(self.theirOffers).forEach(function (their_offer) {
    var interval = self.config['offer_grace_interval']
    if(their_offer.expiredShift((!!interval) ? (-interval) : 0)){
      delete self.theirOffers[their_offer.oid]
      self.fireEvent('offersUpdated', null)
    }
  })
}

EAgent.prototype.registerMyOffer = function(offer){
  this.myOffers[offer.oid] = offer
  this.offersUpdated = true
  this.fireEvent('offersUpdated', offer)
  this.fireEvent('registerMyOffer', offer)
}

EAgent.prototype.cancelMyOffer = function(offer){
  if(this.activeEP && (
        this.activeEP.offer.oid == offer.oid || 
        this.activeEP.my_offer.oid == offer.oid)
      ){
    this.setActiveEP(null)
  }
  if(offer.oid in this.myOffers){
    delete this.myOffers[offer.oid]
  }
  this.fireEvent('offersUpdated', offer)
  this.fireEvent('cancelMyOffer', offer)
}

EAgent.prototype.registerTheirOffer = function(offer){
  this.theirOffers[offer.oid] = offer
  offer.refresh(this.config['offer_expiry_interval'])
  this.offersUpdated = true
  this.fireEvent('offersUpdated', offer)
}

EAgent.prototype.matchOffers = function(){
  var self = this
  if(self.hasActiveEP()){
    return false
  }
  var success = false
  dictValues(self.myOffers).forEach(function (myOffer) {
    dictValues(self.theirOffers).forEach(function(their_offer){
      if(!success && myOffer.matches(their_offer)){
        self.makeExchangeProposal(their_offer, myOffer, function(error, ep){
          if (error){ throw error }
        })
        success = true
      }
    })
  })
  return success
}

EAgent.prototype.makeExchangeProposal = function(theirOffer, myOffer, cb){
  var self = this
  if(self.hasActiveEP()){
    return cb(new Error("Already have active exchange proposal!"))
  }
  var our = theirOffer.B
  var their = theirOffer.A
  self.ewctrl.makeEtxSpec(our, their, function(error, etxSpec){
    if(error){ return cb(error) }
    var ep = new MyEProposal(self.ewctrl, theirOffer, myOffer, etxSpec)
    self.setActiveEP(ep)
    self.postMessage(ep)
    self.fireEvent('make_ep', ep)
    cb(null, ep)
  })
}

EAgent.prototype.dispatchExchangeProposal = function(ep_data, cb){
  var ep = new ForeignEProposal(this.ewctrl, ep_data)
  if(this.hasActiveEP()){
    if(ep.pid == this.activeEP.pid){
      return this.finishExchangeProposal(ep, cb)
    }
  } else {
    if(ep.offer.oid in this.myOffers && !this.hasActiveEP()){
      return this.acceptExchangeProposal(ep, cb)
    }
  }
  // We have neither an offer nor a proposal matching
  //  this ExchangeProposal
  if(ep.offer.oid in this.theirOffers){
    // remove offer if it is in-work
    delete this.theirOffers[ep.offer.oid]
  }
  cb(null)
}

EAgent.prototype.isValidInitialForeignEP = function(ep, my_offer){
  if(!ep.offer.isSameAsMine(my_offer)){
    return false // does not match original offer
  }
  if(!ep.etx_spec){
    return false // need etx_spec
  }
  
  // FIXME check if ep inputs satisfy offer
  

  return true
}

EAgent.prototype.isValidForeignEPReply = function(foreign_ep, my_ep){
  // FIXME implement
  return true
}

EAgent.prototype.acceptExchangeProposal = function(ep, cb){
  var self = this
  var my_offer = self.myOffers[ep.offer.oid]
  if(!self.isValidInitialForeignEP(ep, my_offer)){
    // invalid ep should be viewed as likely malicious and everything aborted
    return cb(new Error("Invalid initial foreign exchange proposal!"))
  }
  ep.accept(my_offer, function(error, replyEP){
    if(error){ return cb(error) }
    self.setActiveEP(replyEP)
    self.postMessage(replyEP)
    self.fireEvent('accept_ep', [ep, replyEP])
    cb(null)
  })
}

EAgent.prototype.clearOrders = function(ep){
  if(ep instanceof MyEProposal){
    if(ep.my_offer){
      delete this.myOffers[ep.my_offer.oid]
    }
    delete this.theirOffers[ep.offer.oid]
  } else {
    delete this.myOffers[ep.offer.oid]
  }
  this.fireEvent('offersUpdated', null)
}

EAgent.prototype.finishExchangeProposal = function(ep, cb){
  var my_ep = this.activeEP
  if(!this.isValidForeignEPReply(ep, my_ep)){
    // invalid ep should be viewed as likely malicious and everything aborted
    this.clearOrders(my_ep)
    this.setActiveEP(null)
    return cb(new Error("Invalid foreign exchange proposal!"))
  }
  my_ep.processReply(ep)
  if(my_ep instanceof MyEProposal){
    this.postMessage(my_ep)
  }
  this.fireEvent('trade_complete', ep)
  this.clearOrders(my_ep)
  this.setActiveEP(null)
  cb(null)
}

EAgent.prototype.postMessage = function(obj){
  this.comm.postMessage(obj.getData())
}

EAgent.prototype.dispatchMessage = function(content){
  if('oid' in content){
    this.registerTheirOffer(EOffer.fromData(content))
  } else if('pid' in content){
    this.dispatchExchangeProposal(content, function(error){
      // TODO handle error?
    })
  }
}

EAgent.prototype.update = function(){
  this.comm.pollAndDispatch()
  if(!this.hasActiveEP() && this.offersUpdated){
    this.offersUpdated = false
    this.matchOffers()
  }
  this.serviceMyOffers()
  this.serviceTheirOffers()
}

module.exports = {
  EAgent: EAgent
}
