
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

module.exports = {
  make_random_id: make_random_id,
  HTTPInterface: HTTPInterface
}

