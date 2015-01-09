var request = require('request') 
var crypto = require('crypto')

function make_random_id() {
  // TODO 128bit as base64
  return crypto.randomBytes(8).toString('hex')
}

/**
 * @class MessageIO
 */
function MessageIO(){
  //
}

MessageIO.prototype.poll = function(url, cb){
  request({method:'GET', url:url, json:true}, function(err, response, messages){
    if(err){
      cb(err)
    } else {
      cb(null, messages)
    }
  })
}

MessageIO.prototype.post = function(url, content, cb){
  request({method:'POST', url:url, json:content}, cb)
}

function dictLength(dictionary){
  return Object.keys(dictionary).length
}

function dictValues(dictionary){
  var values = [];
  Object.keys(dictionary).forEach(function (key){
    values.push(dictionary[key])
  })
  return values
}

function unixTime(){
  var date = new Date()
  return date.getTime() / 1000
}

module.exports = {
  make_random_id: make_random_id,
  unixTime: unixTime,
  dictValues: dictValues,
  dictLength: dictLength,
  MessageIO: MessageIO
}

