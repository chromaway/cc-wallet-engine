var request = require('request') 
var crypto = require('crypto')

function make_random_id() {
  // TODO 128bit as base64
  return crypto.randomBytes(8).toString('hex')
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
}

