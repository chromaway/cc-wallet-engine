/**
 * @param {string} uri
 * @return {?Object}
 */
module.exports.decode_bitcoin_uri = function (uri) {
  if (uri.indexOf('bitcoin:') !== 0) { return null }

  // code from darkwallet
  uri = decodeURIComponent(uri)

  var req // BIP-0021
  var pars = {address: uri.replace('bitcoin:', '').split('?')[0]}
  if (uri.split('?')[1]) {
    uri.split('?')[1].split('&').forEach(function (parsed) {
      if (!parsed) { return }

      pars[parsed.split('=')[0]] = parsed.split('=')[1]
      if (parsed.indexOf('req-') === 0) { req = true }
    })
  }

  return req ? null : pars
}
