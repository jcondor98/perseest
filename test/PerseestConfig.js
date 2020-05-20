// perseest - Test Unit for perseest configuration object
// Uses mocha as the main testing framework and expect.js as the assert library
// jcondor (Paolo Lucchesi)
'use strict'
const expect = require('expect.js')
const sinon = require('sinon')
const ConfigFactory = require('./help/factories').Config
const help = require('../lib/helpers')

describe('Perseest.Config', function () {
  it('should be created with good parameters', () => ConfigFactory.create())

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

    it('should return (and not throw) an error if closing the pool fails', async () => {
      const fake = sinon.fake.rejects(new Error('Rejected'))
      Config.setup(process.env.POSTGRES_URI)
      sinon.replace(Config.pool, 'end', fake)
      try {
        const ret = await Config.cleanup()
        expect(ret).to.be.an(Error)
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

describe('Query hook interface', function () {
  let Config
  beforeEach(() => Config = ConfigFactory.create())

  describe('adding', function () {
    let query
    beforeEach(() => query = Config.queries.get('save'))

    describe('should be successful', function () {
      specify('for a single hook', () => {
        Config.addHook('before', 'save', () => {})
        expect(query.hooks.before).to.have.length(1)
      })

      specify('for multiple hooks', () => {
        const MULT = 8
        const rnd = Math.ceil((Math.random() + 0.1) * MULT - 1)
        for (const n of help.range(1, rnd)) { Config.addHook('before', 'save', () => {}) }
        expect(query.hooks.before).to.have.length(rnd)
      })
    })

    describe('should fail', function () {
      describe('when they are', function () {
        [['an object', { a: 'b' }],
          ['a string', 'ciaone'],
          ['an array', ['a', 'b', 'c']],
          ['undefined', undefined],
          ['null', null],
          ['falsy', false]
        ].forEach(([testCase, obj]) => {
          specify(testCase, () =>
            expect(() => Config.addHook('after', 'save', obj)).to.throwError())
        })
      })

      specify('when trigger is not a string', () =>
        expect(() => Config.addHook('before', { a: 1, b: 2 }, () => {}))
          .to.throwError())

      specify('when temporal trigger is invalid', () =>
        expect(() => Config.addHook('sometimes', 'save', () => {}))
          .to.throwError())
    })
  })

  describe('flushing', function () {
    let q1, q2
    beforeEach(() => {
      for (const when of ['before', 'after']) {
        Config.addHook(when, 'save', () => {})
        Config.addHook(when, 'fetch', () => {})
      }
      q1 = Config.queries.get('save')
      q2 = Config.queries.get('fetch')
    })

    it('should remove all hooks without arguments', function () {
      Config.flushHooks()
      expect(q1.hooks.before).to.be.empty()
      expect(q1.hooks.after).to.be.empty()
    })

    it('should remove related hooks only with trigger', function () {
      Config.flushHooks(null, 'save')
      expect(q2.hooks.before).to.not.be.empty()
      expect(q2.hooks.after).to.not.be.empty()
      expect(q1.hooks.before).to.be.empty()
      expect(q1.hooks.after).to.be.empty()
    })

    it('should remove related hooks only with moment', function () {
      Config.flushHooks('before')
      expect(q1.hooks.before).to.be.empty()
      expect(q2.hooks.before).to.be.empty()
      expect(q1.hooks.after).to.not.be.empty()
      expect(q2.hooks.after).to.not.be.empty()
    })

    it('should remove related hooks with trigger and moment', function () {
      Config.flushHooks('before', 'save')
      expect(q2.hooks.before).to.not.be.empty()
      expect(q2.hooks.after).to.not.be.empty()
      expect(q1.hooks.after).to.not.be.empty()
      expect(q1.hooks.before).to.be.empty()
    })

    describe('should throw an error with', function () {
      specify('non-string \'when\'', () =>
        expect(() => Config.flushHooks({})).to.throwError())

      specify('non-string trigger', () =>
        expect(() => Config.flushHooks('before', () => {})).to.throwError())

      specify('\'when\' not within [\'before\',\'after\']', () =>
        expect(() => Config.flushHooks('abc')).to.throwError())
    })
  })
})
