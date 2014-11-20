var util = require('util')
var Set = require('set')
var make_random_id = require('./utils').make_random_id
var HTTPInterface = require('./utils').HTTPInterface


/**
 * @class CommBase
 */
function CommBase(){
  this.agents = []
}

CommBase.prototype.add_agent = function(agent){
  this.agents.push(agent)
  return true
}


CommBase.prototype.poll_and_dispatch = function(){
  this.dispatch(this.poll())
}

CommBase.prototype.dispatch = function(messages){
  for (var m = 0; m < messages.length; m++) {
    for (var a = 0; a < this.agents.length; a++) {
      this.agents[a].dispatch_message(messages[m])
    }
  }
}

CommBase.prototype.post_message = function(content){
  throw new Error("Called abstract method!")
}

CommBase.prototype.poll = function(){
  throw new Error("Called abstract method!")
}


/**
 * @class HTTPComm
 */
function HTTPComm(config, url){
  CommBase.apply(this, [])
  this.config = config
  this.lastpoll = -1
  this.url = url
  this.own_msgids = new Set([])
  this.http_interface = new HTTPInterface()
}

util.inherits(HTTPComm, CommBase)

HTTPComm.prototype.post_message = function(content){
  var msgid = make_random_id()
  content['msgid'] = msgid
  this.own_msgids.add(msgid)
  return this.http_interface.post(this.url, content)
}

HTTPComm.prototype.poll = function(){
  var ownids = this.own_msgids
  var messages = []
  var url = this.url
  if(this.lastpoll === -1) {
    interval = this.config['offer_expiry_interval']
    url = url + "?from_timestamp_rel=" + interval
  } else {
    url = url + '?from_serial=' + (this.lastpoll + 1)
  }
  var envelopes = this.http_interface.poll(url)
  for (var i = 0; i < envelopes.length; i++) {
    var envelope = envelopes[i]
    var serial = 'serial' in envelope ? envelope['serial'] : 0
    if (serial > this.lastpoll){
      this.lastpoll = serial
    }
    var content = 'content' in envelope ? envelope['content'] : null
    if (content && content['msgid'] && !ownids.contains(content['msgid'])) {
      messages.push(content)
    }
  }
  return messages
}


/**
 * @class ThreadedComm
 */
function ThreadedComm(config, url){
  HTTPComm.apply(this, [config, url])
  this.sleep_time = 1
  this.send_queue = null // TODO
  this.receive_queue = null // TODO
  this.thread = null // TODO
  // TODO implement
  throw new Error("Not implemented!")
}

util.inherits(ThreadedComm, HTTPComm)

ThreadedComm.prototype.post_message = function(content){
  // TODO add to send_queue
  throw new Error("Not implemented!")
}

ThreadedComm.prototype.poll = function(){
  // TODO empty poll queue
  throw new Error("Not implemented!")
}

ThreadedComm.prototype.start = function(){
  // TODO start theread
  throw new Error("Not implemented!")
}

ThreadedComm.prototype.stop = function(){
  // TODO stop theread
  throw new Error("Not implemented!")
}


module.exports = {
  CommBase: CommBase,
  HTTPComm: HTTPComm,
  ThreadedComm: ThreadedComm
}
