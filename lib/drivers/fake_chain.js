var extend = require('shallow-extend')
var bitcore = require('bitcore-lib')
var async = require('async')
var merge = require('merge')

var messages = require('../messages')

var PrivateKey = bitcore.PrivateKey
var Address = bitcore.Address

var idToString = function (id) {
  var idAsString = String(id)
  return (idAsString.length % 2) === 1 ? '0' + idAsString : idAsString
}

// NOTE: FakeChain only supports testnet, and supports no driver options
var FakeChain = function (options, cb) {
  var startingBlockHeight = options.blockHeight || 0
  var height = startingBlockHeight
  var isMutable = options.isMutable
  if ((isMutable === null) || (typeof isMutable === 'undefined')) {
    isMutable = true
  }

  this.__defineGetter__('isMutable', function () { return isMutable })
  this.__defineGetter__('blockHeight', function () { return height })
  this.__defineGetter__('mutableNetwork', function () {
    return bitcore.Networks.testnet
  })
  this.__defineGetter__('immutableNetwork', function () {
    return bitcore.Networks.testnet
  })
  this.__defineGetter__('network', function () {
    return (this.isMutable) ? this.mutableNetwork : this.immutableNetwork
  })

  this.incrementBlockHeight = function () {
    return ++height
  }

  var transactions = []

  this.clearTransactions = function (cb) {
    height = startingBlockHeight
    transactions = []
    cb(null, null)
  }

  this.createTx = function (attrs, cb) {
    attrs.txid = idToString(transactions.push(extend({}, attrs)) - 1)

    cb(null, attrs)
  }

  this.getTx = function (id, cb) {
    cb(null, (transactions[id])
      ? extend({txid: idToString(id)}, transactions[id]) : null)
  }

  this.findTx = function (filter, cb) {
    var ret = []
    for (var i = (transactions.length - 1); i >= 0; i--) {
      if (filter(transactions[i])) {
        ret.push(extend({txid: idToString(i)}, transactions[i]))
      }
    }

    cb(null, ret)
  }

  cb(null)
}

FakeChain.prototype.privkeyToAddr = function (wif) {
  return PrivateKey.fromWIF(wif).toAddress(this.network).toString()
}

FakeChain.prototype.hash160ToAddr = function (hash160, network) {
  return Address.fromPublicKeyHash(new Buffer(hash160, 'hex'),
    network || this.network).toString()
}

FakeChain.prototype.hash160FromAddr = function (addr, network) {
  return (addr === 0) ? 0
    : Address.fromString(addr, network || this.network).hashBuffer
}

FakeChain.prototype.isValidAddr = function (addr, network) {
  return Address.isValid(addr, network || this.network)
}

FakeChain.prototype.save = function (tx, privateKey, cb) {
  // We ignore the private key in this connection.
  this.createTx(merge(tx, {blockHeight: this.blockHeight,
    senderAddr: this.privkeyToAddr(privateKey)}), cb)
}

FakeChain.prototype.txById = function (id, cb) {
  this.getTx(parseInt(id, 10), cb)
}

/* NOTE:
 *  - This needs to return the messages in Descending order by block
 *   In the case that two transactions are in the same block, it goes by time
 * - This should return only 'valid' messages. Not all transactions
 */
FakeChain.prototype.messagesByAddr = function (addr, options, cb) {
  this._filterMessages(extend({}, options, {forAddress: addr}), cb)
}

FakeChain.prototype.messagesInBlock = function (height, options, cb) {
  this._filterMessages(extend({}, options, {blockHeight: height}), cb)
}

FakeChain.prototype._filterMessages = function (options, cb) {
  var where = []

  if (options.forAddress) {
    where.push(function (tx) {
      return ((tx.senderAddr === options.forAddress) ||
        (tx.receiverAddr === options.forAddress))
    })
  }

  if ((options.blockHeight !== null) && (typeof options.blockHeight !== 'undefined')) {
    where.push(function (tx) {
      return (tx.blockHeight === parseInt(options.blockHeight, 10))
    })
  } else {
    if (options.startBlock) {
      where.push(function (tx) {
        return (tx.blockHeight >= parseInt(options.startBlock, 10))
      })
    }

    if (options.endBlock) {
      return where.push(function (tx) {
        (tx.blockHeight <= parseInt(options.endBlock, 10))
      })
    }
  }

  if (options.between) {
    var addr1 = options.between[0]
    var addr2 = options.between[1]

    where.push(function (tx) {
      return (((addr1 === tx.senderAddr) && (addr2 === tx.receiverAddr)) ||
        ((addr2 === tx.senderAddr) && (addr1 === tx.receiverAddr)))
    })
  }

  async.waterfall([
    function (next) {
      this.findTx(function (tx) {
        return where.every(function (f) { return f(tx) })
      }, next)
    }.bind(this),
    function (transactions, waterfallNext) {
      async.filter(transactions.map(function (tx) {
        return messages.fromTx(this, tx)
      }, this), function (msg, next) {
        if (!msg) return next(false)

        msg.isValid(function (err, res) {
          if (err) throw err
          next(!res)
        })
      }, function (messages) { waterfallNext(null, messages) })
    }.bind(this)],
    function (err, messages) {
      if (err) throw err

      // This can only be determined after the transactions have been parsed:
      if ((messages.length > 0) && (options.type)) {
        messages = messages.filter(
          function (msg) { return msg.messageType === options.type })
      }

      cb(null, messages)
    })
}

module.exports = {
  FakeChain: FakeChain
}
