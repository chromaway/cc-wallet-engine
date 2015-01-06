/**
 * @class HistoryTargetModel
 * @param {external:cc-wallet-core.HistoryTarget} historyTarget
 */
function HistoryTargetModel(historyTarget) {
  var asset = historyTarget.getAsset()
  var value = historyTarget.getValue()
  this.address = historyTarget.getAddresses()[0]
  this.formattedValue = asset.formatValue(value)
  this.assetMoniker = asset.getMonikers()[0]
}

/**
 * @return {string}
 */
HistoryTargetModel.prototype.getAddress = function () {
  return this.address
}

/**
 * @return {string}
 */
HistoryTargetModel.prototype.getAssetMoniker = function () {
  return this.assetMoniker
}

/**
 * @return {string}
 */
HistoryTargetModel.prototype.getFormattedValue = function () {
  return this.formattedValue
}


module.exports = HistoryTargetModel
