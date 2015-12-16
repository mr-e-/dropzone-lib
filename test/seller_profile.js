/* global describe it before afterEach */
/* eslint no-new: 0 */

var chai = require('chai')
var factories = require('../test/factories/factories')

var fakeConnection = require('../lib/drivers/fake')
var messages = require('../lib/messages')
var profile = require('../lib/profile')
var globals = require('./fixtures/globals')

var async = require('async')

var expect = chai.expect
var Seller = messages.Seller

var SellerProfile = profile.SellerProfile

factories.dz(chai)

describe('SellerProfile', function () {
  var connection = null

  before(function (next) {
    connection = new fakeConnection.FakeBitcoinConnection(function (err) {
      if (err) throw err
      next()
    })
  })

  afterEach(function (next) {
    connection.clearTransactions(function (err) {
      if (err) throw err
      next()
    })
  })

  describe('accessors', function () {
    it('compiles a simple profile', function (nextSpec) {
      var profile = new SellerProfile(connection, globals.testerPublicKey)

      expect(profile.addr).to.equal(globals.testerPublicKey)

      async.series([
        function (next) {
          chai.factory.create('seller',
            connection).save(globals.testerPrivateKey, next)
        },
        function (next) {
          profile.getAttributes(null, function (err, attrs) {
            if (err) throw err
            expect(attrs.validation).to.be.null
            expect(attrs.description).to.equal('abc')
            expect(attrs.alias).to.equal('Satoshi')
            expect(attrs.communicationsAddr).to.equal('n3EMs5L3sHcZqRy35cmoPFgw5AzAtWSDUv')
            expect(attrs.isActive).to.be.true
            next()
          })
        }
      ], nextSpec)
    })

    it('combines attributes from mulitple messages', function (nextSpec) {
      async.series([
        function (next) {
          chai.factory.create('seller',
            connection).save(globals.testerPrivateKey, next)
        },
        function (next) {
          chai.factory.create('seller', connection,
            {description: 'xyz'}).save(globals.testerPrivateKey, next)
        },
        function (next) {
          new SellerProfile(connection, globals.testerPublicKey).getAttributes(
            null, function (err, attrs) {
              if (err) throw err

              expect(attrs.validation).to.be.null
              expect(attrs.description).to.equal('xyz')
              expect(attrs.alias).to.equal('Satoshi')
              expect(attrs.communicationsAddr).to.equal('n3EMs5L3sHcZqRy35cmoPFgw5AzAtWSDUv')
              expect(attrs.isActive).to.be.true
              next()
            })
        }
      ], nextSpec)
    })

    it('supports profile transfers', function (nextSpec) {
      async.series([
        // Standard Seller:
        function (next) {
          chai.factory.create('seller',
            connection).save(globals.testerPrivateKey, next)
        },
        // Seller Transfer to Tester2:
        function (next) {
          chai.factory.create('seller', connection, {
            transferAddr: globals.tester2PublicKey,
            receiverAddr: globals.tester2PublicKey
          }).save(globals.testerPrivateKey, next)
        },
        // Update Tester2 for some added complexity:
        function (next) {
          chai.factory.create('seller', connection, {
            alias: 'New Alias',
            receiverAddr: globals.tester2PublicKey
          }).save(globals.tester2PrivateKey, next)
        },
        function (next) {
          new SellerProfile(connection, globals.tester2PublicKey).getAttributes(
            null, function (err, attrs) {
              if (err) throw err

              expect(attrs.validation).to.be.null
              expect(attrs.description).to.equal('abc')
              expect(attrs.alias).to.equal('New Alias')
              expect(attrs.communicationsAddr).to.equal('n3EMs5L3sHcZqRy35cmoPFgw5AzAtWSDUv')
              expect(attrs.addr).to.equal(globals.tester2PublicKey)
              expect(attrs.isActive).to.be.true
              next()
            })
        }
      ], nextSpec)
    })

    it('supports a transfer in and transfer out', function (nextSpec) {
      async.series([
        // Standard Seller:
        function (next) {
          chai.factory.create('seller',
            connection).save(globals.testerPrivateKey, next)
        },
        // Seller Transfer to Tester2:
        function (next) {
          chai.factory.create('seller', connection, {
            transferAddr: globals.tester2PublicKey,
            receiverAddr: globals.tester2PublicKey
          }).save(globals.testerPrivateKey, next)
        },
        // Tester2 Transfer to Tester 3:
        function (next) {
          chai.factory.create('seller', connection, {
            transferAddr: globals.tester3PublicKey,
            receiverAddr: globals.tester3PublicKey
          }).save(globals.tester2PrivateKey, next)
        },
        function (next) {
          new SellerProfile(connection, globals.tester3PublicKey).getAttributes(
            null, function (err, attrs) {
              if (err) throw err

              expect(attrs.validation).to.be.null
              expect(attrs.description).to.equal('abc')
              expect(attrs.alias).to.equal('Satoshi')
              expect(attrs.communicationsAddr).to.equal('n3EMs5L3sHcZqRy35cmoPFgw5AzAtWSDUv')
              expect(attrs.addr).to.equal(globals.tester3PublicKey)
              expect(attrs.isActive).to.be.true
              next()
            })
        }
      ], nextSpec)
    })

    it('only supports a single transfer in', function (nextSpec) {
      async.series([
        // Address 1 Declaration:
        function (next) {
          chai.factory.create('seller',
            connection).save(globals.testerPrivateKey, next)
        },
        // Address 2 Declaration:
        function (next) {
          new Seller(connection, {description: 'xyz', alias: 'New Alias',
           receiverAddr: globals.tester2PublicKey
          }).save(globals.tester2PrivateKey, next)
        },
        // Address 1 transfers to Address 3:
        function (next) {
          new Seller(connection, {transferAddr: globals.tester3PublicKey,
           receiverAddr: globals.tester3PublicKey
          }).save(globals.testerPrivateKey, next)
        },
        // Address 2 transfers to Address 3:
        function (next) {
          new Seller(connection, {transferAddr: globals.tester3PublicKey,
           receiverAddr: globals.tester3PublicKey
          }).save(globals.tester2PrivateKey, next)
        },
        function (next) {
          new SellerProfile(connection, globals.tester3PublicKey).getAttributes(
            null, function (err, attrs) {
              if (err) throw err

              expect(attrs.validation).to.be.null
              expect(attrs.description).to.equal('abc')
              expect(attrs.alias).to.equal('Satoshi')
              expect(attrs.communicationsAddr).to.equal('n3EMs5L3sHcZqRy35cmoPFgw5AzAtWSDUv')
              expect(attrs.addr).to.equal(globals.tester3PublicKey)
              expect(attrs.transferAddr).to.be.nil
              expect(attrs.isActive).to.be.true
              next()
            })
        }
      ], nextSpec)
    })

    it('supports deactivation', function (nextSpec) {
      async.series([
        // Standard Seller:
        function (next) {
          chai.factory.create('seller',
            connection).save(globals.testerPrivateKey, next)
        },
        // Seller Deactivates his account:
        function (next) {
          new Seller(connection, {receiverAddr: globals.testerPublicKey,
            transferAddr: 0 }).save(globals.testerPrivateKey, next)
        },
        function (next) {
          new SellerProfile(connection, globals.testerPublicKey).getAttributes(
            null, function (err, attrs) {
              if (err) throw err

              expect(attrs.transferAddr).to.equal(0)
              expect(attrs.isActive).to.be.false
              expect(attrs.isClosed).to.be.true
              next()
            })
        }
      ], nextSpec)
    })

    it('will stop merging attributes after a transfer out', function (nextSpec) {
      async.series([
        // Standard Seller:
        function (next) {
          chai.factory.create('seller',
            connection).save(globals.testerPrivateKey, next)
        },
        // Address 1 transfers to Address 2:
        function (next) {
          new Seller(connection, {transferAddr: globals.tester2PublicKey,
           receiverAddr: globals.tester2PublicKey
          }).save(globals.testerPrivateKey, next)
        },
        // Address 1 changes description:
        function (next) {
          new Seller(connection, {
            description: 'xyz'
          }).save(globals.testerPrivateKey, next)
        },
        function (next) {
          new SellerProfile(connection, globals.testerPublicKey).getAttributes(
            null, function (err, attrs) {
              if (err) throw err

              expect(attrs.description).to.equal('abc')
              expect(attrs.alias).to.equal('Satoshi')
              expect(attrs.communicationsAddr).to.equal('n3EMs5L3sHcZqRy35cmoPFgw5AzAtWSDUv')
              expect(attrs.addr).to.equal(globals.testerPublicKey)
              expect(attrs.transferAddr).to.equal(globals.tester2PublicKey)
              expect(attrs.isActive).to.be.false
              expect(attrs.isClosed).to.be.false
              next()
            })
        },
        function (next) {
          new SellerProfile(connection, globals.tester2PublicKey).getAttributes(
            null, function (err, attrs) {
              if (err) throw err

              expect(attrs.description).to.equal('abc')
              expect(attrs.alias).to.equal('Satoshi')
              expect(attrs.communicationsAddr).to.equal('n3EMs5L3sHcZqRy35cmoPFgw5AzAtWSDUv')
              expect(attrs.addr).to.equal(globals.tester2PublicKey)
              expect(attrs.transferAddr).to.be.undefined
              expect(attrs.isActive).to.be.true
              expect(attrs.isClosed).to.be.false
              next()
            })
        }
      ], nextSpec)
    })

    it('will stop merging attributes after a cancellation', function (nextSpec) {
      async.series([
        // Standard Seller:
        function (next) {
          chai.factory.create('seller',
            connection).save(globals.testerPrivateKey, next)
        },
        // Address 1 closes its account:
        function (next) {
          new Seller(connection, {transferAddr: 0,
           receiverAddr: globals.testerPublicKey
          }).save(globals.testerPrivateKey, next)
        },
        // Address changes description:
        function (next) {
          new Seller(connection, {description: 'xyz'}).save(
            globals.testerPrivateKey, next)
        },
        function (next) {
          new SellerProfile(connection, globals.testerPublicKey).getAttributes(
            null, function (err, attrs) {
              if (err) throw err

              expect(attrs.validation).to.be.null
              expect(attrs.description).to.equal('abc')
              expect(attrs.alias).to.equal('Satoshi')
              expect(attrs.communicationsAddr).to.equal('n3EMs5L3sHcZqRy35cmoPFgw5AzAtWSDUv')
              expect(attrs.addr).to.equal(globals.testerPublicKey)
              expect(attrs.transferAddr).to.equal(0)
              expect(attrs.isActive).to.be.false
              next()
            })
        }
      ], nextSpec)
    })

    it('will merge attributes in a cancellation message', function (nextSpec) {
      async.series([
        // Standard Seller:
        function (next) {
          chai.factory.create('seller',
            connection).save(globals.testerPrivateKey, next)
        },
        // Address 1 closes its account:
        function (next) {
          new Seller(connection, {transferAddr: 0, description: 'xyz',
           receiverAddr: globals.testerPublicKey
          }).save(globals.testerPrivateKey, next)
        },
        function (next) {
          new SellerProfile(connection, globals.testerPublicKey).getAttributes(
            null, function (err, attrs) {
              if (err) throw err

              expect(attrs.validation).to.be.null
              expect(attrs.description).to.equal('xyz')
              expect(attrs.alias).to.equal('Satoshi')
              expect(attrs.communicationsAddr).to.equal('n3EMs5L3sHcZqRy35cmoPFgw5AzAtWSDUv')
              expect(attrs.addr).to.equal(globals.testerPublicKey)
              expect(attrs.transferAddr).to.equal(0)
              expect(attrs.isActive).to.be.false
              next()
            })
        }
      ], nextSpec)
    })

    it('will merge attributes in a transfer message', function (nextSpec) {
      async.series([
        // Standard Seller:
        function (next) {
          chai.factory.create('seller',
            connection).save(globals.testerPrivateKey, next)
        },
        // Address 1 closes its account:
        function (next) {
          new Seller(connection, {transferAddr: globals.tester2PublicKey,
            description: 'xyz', receiverAddr: globals.tester2PublicKey
          }).save(globals.testerPrivateKey, next)
        },
        function (next) {
          new SellerProfile(connection, globals.testerPublicKey).getAttributes(
            null, function (err, attrs) {
              if (err) throw err

              expect(attrs.validation).to.be.null
              expect(attrs.description).to.equal('xyz')
              expect(attrs.alias).to.equal('Satoshi')
              expect(attrs.communicationsAddr).to.equal('n3EMs5L3sHcZqRy35cmoPFgw5AzAtWSDUv')
              expect(attrs.addr).to.equal(globals.testerPublicKey)
              expect(attrs.transferAddr).to.equal(globals.tester2PublicKey)
              expect(attrs.isActive).to.be.false
              next()
            })
        }
      ], nextSpec)
    })

    describe('validations', function () {
      it('won\'t compile a deactivated transfer', function (nextSpec) {
        async.series([
          // Standard Seller:
          function (next) {
            chai.factory.create('seller',
              connection).save(globals.testerPrivateKey, next)
          },
          // Address 1 closes its account:
          function (next) {
            new Seller(connection, {transferAddr: 0,
              receiverAddr: globals.testerPublicKey
            }).save(globals.testerPrivateKey, next)
          },
          // Address 1 transfers its account:
          function (next) {
            new Seller(connection, {transferAddr: globals.tester2PublicKey,
              receiverAddr: globals.tester2PublicKey
            }).save(globals.testerPrivateKey, next)
          },
          function (next) {
            new SellerProfile(connection, globals.tester2PublicKey).getAttributes(
              null, function (err, attrs) {
                if (err) throw err

                expect(attrs.validation).to.be.null
                next()
              })
          }
        ], nextSpec)
      })
    })
/*
    it "won't compile a deactivated transfer" do
      # Standard Seller:
      Dropzone::Seller.sham!(:build).save! test_privkey

      # Address 1 closes its account:
      Dropzone::Seller.new( receiver_addr: test_pubkey,
        transfer_pkey: 0 ).save! test_privkey

      # Address 1 transfers its account:
      Dropzone::Seller.new( receiver_addr: TESTER2_PUBLIC_KEY,
        transfer_pkey: TESTER2_PUBLIC_KEY ).save! test_privkey

      profile = Dropzone::SellerProfile.new TESTER2_PUBLIC_KEY

      expect(profile.valid?).to be_falsey
    end

    it "requires a valid seller message" do
      # No messages have been created here yet:
      profile = Dropzone::SellerProfile.new test_pubkey

      expect(profile.valid?).to be_falsey
      expect(profile.errors.count).to eq(1)
      expect(profile.errors.on(:addr)).to eq(['profile not found'])
    end

    it "won't accept a closed account transfer" do
      # Standard Seller:
      Dropzone::Seller.sham!(:build).save! test_privkey

      # Address 1 closes its account:
      Dropzone::Seller.new( receiver_addr: test_pubkey,
        transfer_pkey: 0 ).save! test_privkey

      # Address 1 transfers its account:
      Dropzone::Seller.new( receiver_addr: TESTER2_PUBLIC_KEY,
        transfer_pkey: TESTER2_PUBLIC_KEY ).save! test_privkey

      profile = Dropzone::SellerProfile.new TESTER2_PUBLIC_KEY
      expect(profile.valid?).to be_falsey
      expect(profile.errors.count).to eq(1)
      expect(profile.errors.on(:prior_profile)).to eq(['invalid transfer or closed'])
    end

    it "won't accept a second transfer out" do
      # Standard Seller:
      Dropzone::Seller.sham!(:build).save! test_privkey

      # Address 1 transfers to address 2:
      Dropzone::Seller.new( receiver_addr: TESTER2_PUBLIC_KEY,
        transfer_pkey: TESTER2_PUBLIC_KEY ).save! test_privkey

      # Address 1 transfers to address 3:
      Dropzone::Seller.new( receiver_addr: TESTER3_PUBLIC_KEY,
        transfer_pkey: TESTER3_PUBLIC_KEY ).save! test_privkey

      profile2 = Dropzone::SellerProfile.new TESTER2_PUBLIC_KEY
      profile3 = Dropzone::SellerProfile.new TESTER3_PUBLIC_KEY

      expect(profile2.valid?).to be_truthy
      expect(profile2.description).to eq("abc")
      expect(profile2.alias).to eq("Satoshi")
      expect(profile2.communications_pkey).to eq('n3EMs5L3sHcZqRy35cmoPFgw5AzAtWSDUv')
      expect(profile2.addr).to eq(TESTER2_PUBLIC_KEY)
      expect(profile2.active?).to be_truthy

      expect(profile3.valid?).to be_falsey
      expect(profile3.errors.count).to eq(1)
      expect(profile3.errors.on(:prior_profile)).to eq(['invalid transfer or closed'])
    end

  end
*/
  })
})