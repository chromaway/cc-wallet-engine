//var request = require('browser-request') // only works in browser, if at all?
var crypto = require('crypto')

function make_random_id() {
  // TODO 128bit as base64
  return crypto.randomBytes(8).toString('hex')
}

/**
 * @class HTTPInterface
 * TODO test it
 */
function HTTPInterface(){
  //
}

HTTPInterface.prototype.poll = function(url){
  var result = []
  request({method:'GET', url:url, json:true}, function(err, response, body){
    if(err){
      throw err
    }
    result = body // json parse needed?
  })
  return result

  /*
  var result = []
  jQuery.ajax({
    type: 'GET',
    async: false,
    url: url,
    success:function(result){
      result = JSON.parse(result)
    }
  })
  return result
  */
}

HTTPInterface.prototype.post = function(url, content){
  var posted = false
  request({method:'POST', url:url, json:content}, function(err, response, body){
    if(err){
      throw err
    }
    posted = true
  })
  return posted

  /*
  var posted = true
  jQuery.ajax({
    type: 'POST',
    async: false,
    url: url,
    data: JSON.stringify(content),
    error: function (){
      posted = false
    }
  })
  return posted
  */
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
  HTTPInterface: HTTPInterface
}

