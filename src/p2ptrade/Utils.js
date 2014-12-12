
function make_random_id() {
  return 4 // chosen by fair dice roll.
           // guaranteed to be random.
           // TODO fix it ...
           // TODO test it
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
  jQuery.ajax({
    type: 'GET',
    async: false,
    url: url,
    success:function(result){
      result = JSON.parse(result)
    }
  })
  return result
}

HTTPInterface.prototype.post = function(url, content){
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
}

function dictValues(dictionary){
  var values = [];
  Object.keys(directory).forEach(function (key){
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
  HTTPInterface: HTTPInterface
}

