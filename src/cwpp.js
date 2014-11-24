/**
 */
exports.make_cinputs_payment_request = function (value, address, assetId, colorDesc) {
  return {
    protocol: 'cwpp/0.0',
    messageType: 'PaymentRequest',
    acceptedMethods: {cinputs: true},
    value: value,
    address: address,
    colorDesc: colorDesc,
    assetId: assetId
  }
}

/**
 */
exports.make_cinputs_proc_req_1 = function (colorDesc, cinputs, change) {
  return {
    protocol: 'cwpp/0.0',
    messageType: 'ProcessRequest',
    method: 'cinputs',
    stage: 1,
    colorDesc: colorDesc,
    cinputs: cinputs,
    change: change
  }
}

/**
 */
exports.make_cinputs_proc_req_2 = function (tx) {
  return {
    protocol: 'cwpp/0.0',
    messageType: 'ProcessRequest',
    method: 'cinputs',
    stage: 2,
    tx: tx
  }
}

exports.make_cwpp_uri = function (host, hash) {
  return 'cwpp:http://' + host + '/cwpp/' + hash;
}

/**
 * @param {string} uri
 * @return {boolean}
 */
exports.is_cwpp_uri = function (uri) {
  return uri.indexOf('cwpp:') === 0
}

/**
 * @param {string} uri
 * @return {?string}
 */
exports.requestURL = function (uri) {
  if (!exports.is_cwpp_uri(uri)) { return null }

  return uri.slice(5)
}

/**
 * @param {string} uri
 * @return {?string}
 */
exports.processURL = function (uri) {
  if (!exports.is_cwpp_uri(uri)) { return null }

  return exports.requestURL(uri).replace('/cwpp/', '/cwpp/process/')
}
