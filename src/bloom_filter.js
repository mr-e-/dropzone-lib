var BloomFilter = require('bitcore-p2p').BloomFilter

BloomFilter.prototype.insertAddress = function (address) {
  this._addresses = this._addresses || []
  this._addresses.push(address.toString())
  this.insert(address)
}

BloomFilter.prototype.isRelevantAddress = function (address) {
  return this._addresses.indexOf(address) > -1
}

module.exports = BloomFilter
