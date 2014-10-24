
var bitcoin = require('coloredcoinjs-lib').bitcoin

function AssetTargetModel(assetTarget) {
  var value = assetTarget.getValue();
  var asset = assetTarget.getAsset();
  this.address = assetTarget.getAddress().toBase58Check();
  this.formattedValue = asset.formatValue(value);
  this.assetMoniker = asset.getMonikers()[0];
}

AssetTargetModel.prototype.getAddress = function () {
  return this.address;
}

AssetTargetModel.prototype.getAssetMoniker = function () {
  return this.assetMoniker;
}

AssetTargetModel.prototype.getFormattedValue = function () {
  return this.formattedValue;
}

module.exports = AssetTargetModel;
