// perseest - Test Unit for Perseest.Config
// jcondor (Paolo Lucchesi)
'use strict'
const expect = require('expect.js')
const sinon = require('sinon')
const ConfigFactory = require('./help/factories').Config

describe('Perseest.Config', function () {
  it('should be created with good parameters', () =>
    expect(() => ConfigFactory.create()).to.not.throwError())

  describe('should throw an error when created with', function () {
    specify('blank table name', () =>
      expect(() => ConfigFactory.create({ table: '' })).to.throwError())

    specify('non-string table name', () =>
      expect(() => ConfigFactory.create({ table: { a: 1 } })).to.throwError())

    specify('blank primary key', () =>
      expect(() => ConfigFactory.create({ primaryKey: '' })).to.throwError())

    specify('non-string primary key', () =>
      expect(() => ConfigFactory.create({ primaryKey: { a: 321321 } }))
        .to.throwError())

    for (const attr of ['ids', 'columns']) {
      specify(`non-iterable ${attr} collection`, () => {
        const args = Object.fromEntries([[attr, { a: 1, b: 2 }]])
        expect(() => ConfigFactory.create(args)).to.throwError()
      })
    }
  })
})

describe('Database', function () {
  let Config
  beforeEach(async () => {
    sinon.restore()
    Config = ConfigFactory.create()
  })

  describe('setting up', function () {
    it('should be successful with no arguments', () => {
      expect(() => Config.setup()).to.not.throwError()
      expect(Config.pool).to.be.ok()
    })

    it('should be successful with a URL string', () => {
      expect(() => Config.setup(process.env.POSTGRES_URI)).to.not.throwError()
      expect(Config.pool).to.be.ok()
    })

    it('should be successful with a configuration object', () => {
      expect(() => Config.setup({
        user: 'user',
        host: 'mydb.server.net',
        database: 'testdb',
        password: 'mypassword',
        port: 1234
      })).to.not.throwError()
      expect(Config.pool).to.be.ok()
    })

    it('should never throw an error with bad parameters', () => {
      expect(() => Config.setup(() => {})).to.not.throwError()
    })
  })

  describe('cleaning up', function () {
    it('should attempt to close the pool if active', async () => {
      const fake = sinon.fake.resolves()
      Config.setup(process.env.POSTGRES_URI)
      sinon.replace(Config.pool, 'end', fake)
      try {
        await Config.cleanup()
      } catch (err) {
        throw err
      }
      expect(fake.callCount).to.be(1)
    })

    it('should return doing nothing if no active pool is present', async () => {
      try {
        await Config.cleanup()
      } catch (err) {
        throw err
      }
    })

    it('should never throw an error if closing the pool fails', async () => {
      const fake = sinon.fake.rejects(new Error('Rejected'))
      Config.setup(process.env.POSTGRES_URI)
      sinon.replace(Config.pool, 'end', fake)
      try {
        await Config.cleanup()
      } catch (err) {
        throw err
      }
    })
  })

  after(() => {
    sinon.restore()
    Config.setup(process.env.POSTGRES_URI)
  })
})
