var request = require('request') 
var crypto = require('crypto')

function makeRandomId() {
  // TODO 128bit as base64
  return crypto.randomBytes(8).toString('hex')
}

function dictLength(dictionary){
  return Object.keys(dictionary).length
}

function dictValues(dictionary){
  return Object.keys(dictionary).map(function (key){
    return dictionary[key]
  })
}

function unixTime(){
  return new Date().getTime() / 1000
}

module.exports = {
  makeRandomId: makeRandomId,
  unixTime: unixTime,
  dictValues: dictValues,
  dictLength: dictLength,
}

