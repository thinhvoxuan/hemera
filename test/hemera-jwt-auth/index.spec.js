'use strict'

const Hemera = require('../../packages/hemera')
const HemeraJwt = require('../../packages/hemera-jwt-auth')
HemeraJwt.options.jwt.secret = 'test'
const Code = require('code')
const HemeraTestsuite = require('hemera-testsuite')

const expect = Code.expect

process.setMaxListeners(0)

describe('Hemera-jwt-auth', function () {
  const PORT = 6244
  const flags = ['--user', 'derek', '--pass', 'foobar']
  const authUrl = 'nats://derek:foobar@localhost:' + PORT
  let server
  // token with { scope: ['math'] }
  const jwtToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzY29wZSI6WyJtYXRoIl0sImlhdCI6MTQ4ODEyMjIwN30.UPLLbjDgkB_ajQjI7BUlpUGfZYvsqHP3NqWQIavibeQ'

  // Start up our own nats-server
  before(function (done) {
    server = HemeraTestsuite.start_server(PORT, flags, done)
  })

  // Shutdown our server after we are done
  after(function () {
    server.kill()
  })

  it('Should be able to pass the metadata (token) to nested acts', function (done) {
    const nats = require('nats').connect(authUrl)

    const hemera = new Hemera(nats, {
      crashOnFatal: false
    })

    hemera.use(HemeraJwt)

    hemera.ready(() => {
      hemera.add({
        topic: 'math',
        cmd: 'sub',
        auth$: {
          scope: 'math'
        }
      }, function (req, cb) {
        cb(null, req.a - req.b)
      })
      hemera.add({
        topic: 'math',
        cmd: 'add',
        auth$: {
          scope: 'math'
        }
      }, function (req, cb) {
        this.act({
          topic: 'math',
          cmd: 'sub',
          a: req.a + req.b,
          b: 100
        }, function (err, res) {
          cb(err, res)
        })
      })

      hemera.act({
        meta$: {
          jwtToken
        },
        topic: 'math',
        cmd: 'add',
        a: 100,
        b: 200
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp).to.be.equals(200)
        hemera.close()
        done()
      })
    })
  })

  it('Should be able to authorize with scope as array', function (done) {
    const nats = require('nats').connect(authUrl)

    const hemera = new Hemera(nats, {
      crashOnFatal: false
    })

    hemera.use(HemeraJwt)

    hemera.ready(() => {
      hemera.add({
        topic: 'math',
        cmd: 'add',
        auth$: {
          scope: ['math', 'a', 'b']
        }
      }, function (req, cb) {
        cb(null, true)
      })

      hemera.act({
        meta$: {
          jwtToken
        },
        topic: 'math',
        cmd: 'add',
        a: 100,
        b: 200
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp).to.be.equals(true)
        hemera.close()
        done()
      })
    })
  })

  it('Should be able to authorize with scope as string', function (done) {
    const nats = require('nats').connect(authUrl)

    const hemera = new Hemera(nats, {
      crashOnFatal: false
    })

    hemera.use(HemeraJwt)

    hemera.ready(() => {
      hemera.add({
        topic: 'math',
        cmd: 'add',
        auth$: {
          scope: 'math'
        }
      }, function (req, cb) {
        cb(null, true)
      })

      hemera.act({
        meta$: {
          jwtToken
        },
        topic: 'math',
        cmd: 'add',
        a: 100,
        b: 200
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp).to.be.equals(true)
        hemera.close()
        done()
      })
    })
  })

  it('Should return an error when scope is invalid', function (done) {
    const nats = require('nats').connect(authUrl)

    const hemera = new Hemera(nats, {
      crashOnFatal: false
    })

    hemera.use(HemeraJwt)

    hemera.ready(() => {
      hemera.add({
        topic: 'math',
        cmd: 'add',
        auth$: {
          scope: 'math111'
        }
      }, function (req, cb) {
        cb(null, true)
      })

      hemera.act({
        meta$: {
          jwtToken
        },
        topic: 'math',
        cmd: 'add',
        a: 100,
        b: 200
      }, function (err, resp) {
        expect(err).to.be.exists()
        expect(err.name).to.be.equals('HemeraError')
        expect(err.message).to.be.equals('Extension error')
        expect(err.cause.name).to.be.equals('JwtError')
        expect(err.cause.message).to.be.equals('Invalid scope')
        hemera.close()
        done()
      })
    })
  })

  it('Should return an error when auth object is no object', function (done) {
    const nats = require('nats').connect(authUrl)

    const hemera = new Hemera(nats, {
      crashOnFatal: false
    })

    hemera.use(HemeraJwt)

    hemera.ready(() => {
      hemera.add({
        topic: 'math',
        cmd: 'add',
        auth$: 2232323
      }, function (req, cb) {
        cb()
      })

      hemera.act({
        meta$: {
          jwtToken
        },
        topic: 'math',
        cmd: 'add',
        a: 100,
        b: 200
      }, function (err, resp) {
        expect(err).to.be.exists()
        expect(err.name).to.be.equals('HemeraError')
        expect(err.message).to.be.equals('Extension error')
        expect(err.cause.name).to.be.equals('JwtError')
        expect(err.cause.message).to.be.equals('Invalid auth$ options')
        hemera.close()
        done()
      })
    })
  })

  it('Should ignore authentication when auth is disabled', function (done) {
    const nats = require('nats').connect(authUrl)

    const hemera = new Hemera(nats, {
      crashOnFatal: false
    })

    hemera.use(HemeraJwt)

    hemera.ready(() => {
      hemera.add({
        topic: 'math',
        cmd: 'sub',
        auth$: { enabled: false }
      }, function (req, cb) {
        cb(null, req.a - req.b)
      })
      hemera.add({
        topic: 'math',
        cmd: 'add',
        auth$: {
          scope: 'math'
        }
      }, function (req, cb) {
        this.act({
          topic: 'math',
          cmd: 'sub',
          a: req.a + req.b,
          b: 100
        }, function (err, res) {
          cb(err, res)
        })
      })

      hemera.act({
        meta$: {
          jwtToken
        },
        topic: 'math',
        cmd: 'add',
        a: 100,
        b: 200
      }, function (err, resp) {
        expect(err).to.be.not.exists()
        expect(resp).to.be.equals(200)
        hemera.close()
        done()
      })
    })
  })
})
