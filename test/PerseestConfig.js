// perseest - Test Unit for perseest configuration object
// Uses mocha as the main testing framework and expect.js as the assert library
// jcondor (Paolo Lucchesi)
'use strict'
const expect = require('expect.js')
const sinon = require('sinon')
const Config = require('../lib/PerseestConfig')
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
  })

  it('should accept an enumerable object as column collection', () => {
    const conf = new Config('SomeTable', 'pk', {
      col1: null,
      col2: { id: true },
      col3: {}
    })
    expect(conf.columns.size).to.be(4) // col[123] + pk
    expect(conf.columns.get('col2').id).to.be(true)
  })

  it('should automatically set \'id\' for the primary key', () => {
    const conf = new Config('SomeTable', 'pk', ['pk', 'hello'])
    expect(conf.columns.get('pk').id).to.be(true)
  })
})

describe('Database', function () {
  let conf
  beforeEach(async () => {
    sinon.restore()
    conf = ConfigFactory.create()
  })

  describe('setting up', function () {
    it('should be successful with no arguments', () => {
      expect(() => conf.setup()).to.not.throwError()
      expect(conf.pool).to.be.ok()
    })

    it('should be successful with a URL string', () => {
      expect(() => conf.setup(process.env.POSTGRES_URI)).to.not.throwError()
      expect(conf.pool).to.be.ok()
    })

    it('should be successful with a configuration object', () => {
      expect(() => conf.setup({
        user: 'user',
        host: 'mydb.server.net',
        database: 'testdb',
        password: 'mypassword',
        port: 1234
      })).to.not.throwError()
      expect(conf.pool).to.be.ok()
    })

    it('should never throw an error with bad parameters', () => {
      expect(() => conf.setup(() => {})).to.not.throwError()
    })
  })

  describe('cleaning up', function () {
    it('should attempt to close the pool if active', async () => {
      const fake = sinon.fake.resolves()
      conf.setup(process.env.POSTGRES_URI)
      sinon.replace(conf.pool, 'end', fake)
      try {
        await conf.cleanup()
      } catch (err) {
        throw err
      }
      expect(fake.callCount).to.be(1)
    })

    it('should return doing nothing if no active pool is present', async () => {
      try {
        await conf.cleanup()
      } catch (err) {
        throw err
      }
    })

    it('should return (and not throw) an error if closing the pool fails', async () => {
      const fake = sinon.fake.rejects(new Error('Rejected'))
      conf.setup(process.env.POSTGRES_URI)
      sinon.replace(conf.pool, 'end', fake)
      try {
        const ret = await conf.cleanup()
        expect(ret).to.be.an(Error)
      } catch (err) {
        throw err
      }
    })
  })

  after(() => {
    sinon.restore()
    conf.setup(process.env.POSTGRES_URI)
  })
})

describe('Query hook interface', function () {
  let conf
  beforeEach(() => conf = ConfigFactory.create())

  describe('adding', function () {
    let query
    beforeEach(() => query = conf.queries.get('save'))

    describe('should be successful', function () {
      specify('for a single hook', () => {
        conf.addHook('before', 'save', () => {})
        expect(query.hooks.before).to.have.length(1)
      })

      specify('for multiple hooks', () => {
        const MULT = 8
        const rnd = Math.ceil((Math.random() + 0.1) * MULT - 1)
        for (const n of help.range(1, rnd)) { conf.addHook('before', 'save', () => {}) }
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
            expect(() => conf.addHook('after', 'save', obj)).to.throwError())
        })
      })

      specify('when trigger is not a string', () =>
        expect(() => conf.addHook('before', { a: 1, b: 2 }, () => {}))
          .to.throwError())

      specify('when temporal trigger is invalid', () =>
        expect(() => conf.addHook('sometimes', 'save', () => {}))
          .to.throwError())
    })
  })

  describe('flushing', function () {
    let q1, q2
    beforeEach(() => {
      for (const when of ['before', 'after']) {
        conf.addHook(when, 'save', () => {})
        conf.addHook(when, 'fetch', () => {})
      }
      q1 = conf.queries.get('save')
      q2 = conf.queries.get('fetch')
    })

    it('should remove all hooks without arguments', function () {
      conf.flushHooks()
      expect(q1.hooks.before).to.be.empty()
      expect(q1.hooks.after).to.be.empty()
    })

    it('should remove related hooks only with trigger', function () {
      conf.flushHooks(null, 'save')
      expect(q2.hooks.before).to.not.be.empty()
      expect(q2.hooks.after).to.not.be.empty()
      expect(q1.hooks.before).to.be.empty()
      expect(q1.hooks.after).to.be.empty()
    })

    it('should remove related hooks only with moment', function () {
      conf.flushHooks('before')
      expect(q1.hooks.before).to.be.empty()
      expect(q2.hooks.before).to.be.empty()
      expect(q1.hooks.after).to.not.be.empty()
      expect(q2.hooks.after).to.not.be.empty()
    })

    it('should remove related hooks with trigger and moment', function () {
      conf.flushHooks('before', 'save')
      expect(q2.hooks.before).to.not.be.empty()
      expect(q2.hooks.after).to.not.be.empty()
      expect(q1.hooks.after).to.not.be.empty()
      expect(q1.hooks.before).to.be.empty()
    })

    describe('should throw an error with', function () {
      specify('non-string \'when\'', () =>
        expect(() => conf.flushHooks({})).to.throwError())

      specify('non-string trigger', () =>
        expect(() => conf.flushHooks('before', () => {})).to.throwError())

      specify('\'when\' not within [\'before\',\'after\']', () =>
        expect(() => conf.flushHooks('abc')).to.throwError())
    })
  })
})

describe('Perseest.Config.ColumnMap', function () {
  describe('creating', function () {
    describe('should be successful', function () {
      specify('with no arguments', () =>
        expect(new Config.ColumnMap().size).to.be(0))

      specify('with a single column represented by a string', () =>
        expect(new Config.ColumnMap('col1').size).to.be(1))

      specify('with columns represented by strings', () =>
        expect(new Config.ColumnMap(['c1', 'c2']).size).to.be(2))

      specify('with columns represented by [k,v] arrays', () =>
        expect(new Config.ColumnMap([
          ['id', { id: true }],
          ['c', { id: false }]
        ]).size).to.be(2))

      specify('with mixed columns representations', () =>
        expect(new Config.ColumnMap([
          ['id', { id: true }],
          'c1', 'c2', 'c3',
          ['uniq', { id: true }]
        ]).size).to.be(5))
    })
  })

  describe('adding columns', function () {
    let map
    beforeEach(() => map = new Config.ColumnMap())

    describe('should be successful', function () {
      specify('with just the column name', () => {
        map.set('someColumn')
        expect(map.size).to.be(1)
        expect(map.has('someColumn')).to.be(true)
      })

      specify('with column name and properties', () => {
        const props = { id: true }
        map.set('someColumn', props)
        expect(map.size).to.be(1)
        expect(map.has('someColumn')).to.be(true)
        expect(map.get('someColumn')).to.be(props)
      })
    })

    describe('should fail', function () {
      specify('with no arguments', () =>
        expect(() => map.set()).to.throwError())

      specify('with blank name', () =>
        expect(() => map.set('')).to.throwError())

      specify('with name not being a string', () => {
        expect(() => map.set(['a', 'b', 'c'])).to.throwError()
        expect(() => map.set({ a: 123 })).to.throwError()
        expect(() => map.set(() => {})).to.throwError()
        expect(() => map.set(null)).to.throwError()
      })
    })
  })
})
