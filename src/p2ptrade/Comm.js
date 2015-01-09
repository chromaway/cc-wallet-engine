var util = require('util')
var Set = require('set')
var make_random_id = require('./Utils').make_random_id
var MessageIO = require('./Utils').MessageIO


/**
 * @class CommBase
 */
function CommBase(){
  this.agents = []
}

CommBase.prototype.addAgent = function(agent){
  this.agents.push(agent)
  return true
}


CommBase.prototype.poll_and_dispatch = function(){
  this.dispatch(this.poll())
}

CommBase.prototype.dispatch = function(messages){
  var self = this
  messages.forEach(function(message){
    self.agents.forEach(function(agent){
      agent.dispatch_message(message)
    })
  })
}

CommBase.prototype.post_message = function(content){
  throw new Error("Called abstract method!")
}

CommBase.prototype.poll = function(){
  throw new Error("Called abstract method!")
}




/**
 * @class ThreadedComm
 */
function ThreadedComm(config, url){
  CommBase.apply(this, [])
  this.config = config
  this.lastpoll = -1
  this.url = url
  this.own_msgids = new Set([])
  this.msgio = new MessageIO()
  this.sleep_time = 1000
  this.send_queue = []
  this.receive_queue = []
  this.thread = null
}

util.inherits(ThreadedComm, CommBase)

ThreadedComm.prototype.asyncPost = function(message){
  var msgid = make_random_id()
  message['msgid'] = msgid
  this.own_msgids.add(msgid)
  this.msgio.post(this.url, message, function(error){
    if (error){
      throw error // TODO how to best handle io errors?
    }
  })
}

ThreadedComm.prototype.asyncPoll = function(){
  var self = this
  var ownids = self.own_msgids
  var url = self.url
  if(self.lastpoll === -1) {
    interval = self.config['offer_expiry_interval']
    url = url + "?from_timestamp_rel=" + interval
  } else {
    url = url + '?from_serial=' + (self.lastpoll + 1)
  }
  self.msgio.poll(url, function(error, envelopes){
    envelopes.forEach(function(envelope){
      var serial = 'serial' in envelope ? envelope['serial'] : 0
      if (serial > self.lastpoll){
        self.lastpoll = serial
      }
      var message = 'content' in envelope ? envelope['content'] : null
      if (message && message['msgid'] && !ownids.contains(message['msgid'])){
        self.receive_queue.push(message)
      }
    })
  })
}

ThreadedComm.prototype.post_message = function(content){
    this.send_queue.push(content)
    return true
}

ThreadedComm.prototype.poll = function(){
  var messages = []
  while(this.receive_queue.length != 0){
    messages.push(this.receive_queue.shift())
  }
  return messages
}

ThreadedComm.prototype.start = function(){
  var self = this
  self.thread = setInterval(function () {
    self.asyncPoll()
    while (self.send_queue.length != 0) {
      var message = self.send_queue.shift()
      self.asyncPost(message)
    }
  }, self.sleep_time)
}

ThreadedComm.prototype.stop = function(){
  clearInterval(this.thread)
}

module.exports = {
  CommBase: CommBase,
  ThreadedComm: ThreadedComm
}
