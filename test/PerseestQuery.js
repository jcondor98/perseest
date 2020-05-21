// perseest - Test Unit for queries
// Uses mocha as the main testing framework and expect.js as the assert library
// jcondor (Paolo Lucchesi)
'use strict'
const expect = require('expect.js')
const sinon = require('sinon')
const Query = require('../lib/PerseestQuery')
const Params = require('../lib/QueryParameters')
const ConfigFactory = require('./help/factories').Config

const negativeTestCases = [
  ['an array', ['a', 'b', 'c']],
  ['an object', { a: 'b' }]
]

const falsyTestCases = [
  ['undefined', undefined],
  ['an empty string', ''],
  ['falsy', false],
  ['null', null]
]

describe('Perseest.Query', function () {
  describe('when created', function () {
    it('should be successful with good parameters', () => {
      const q = new Query({ name: 'q', generate: () => {} })
      expect(q.name).to.be('q')
    })

    describe('should throw an error', function () {
      describe('with name being', function () {
        negativeTestCases.concat(falsyTestCases).concat([
          ['a function', () => {}],
          ['a string beginning with a number', '0abc'],
          ['a string containing symbols', 'ab%$cde']
        ]).forEach(([testCase, obj]) =>
          specify(testCase, () => {
            expect(() => new Query({ name: obj, generate: () => {} }))
              .to.throwError()
          }))
      })

      describe('with generator being', function () {
        negativeTestCases
          .concat(falsyTestCases)
          .concat([['a string', 'abc']])
          .forEach(([testCase, obj]) =>
            specify(testCase, () => {
              expect(() => new Query({ name: 'q', generate: obj }))
                .to.throwError()
            }))
      })

      describe('with transformer being', function () {
        negativeTestCases.concat([['a string', 'abc']])
          .forEach(([testCase, obj]) =>
          specify(testCase, () =>
            expect(() => new Query({
              name: 'q',
              generate: () => {},
              transform: obj
            })).to.throwError()))
      })

      describe('with type being', function() {
        for (const [testCase,obj] of negativeTestCases)
          specify(testCase, () =>
            expect(() => new Query({
              name: 'q',
              generate: () => {},
              type: obj
            })).to.throwError())
      });

      specify('when both type and transformer are specified', () =>
        expect(() => new Query({
          name: 'q',
          generate: () => {},
          transform: () => {},
          type: 'boolean'
        })).to.throwError());

      specify('when type does not exist', () =>
        expect(() => new Query({
          name: 'q',
          generate: () => {},
          type: 'nonexistent'
        })).to.throwError());
    })
  })

  describe('when run', function () {
    let q, conf;
    beforeEach(() => {
      sinon.restore();
      conf = ConfigFactory.create()
      conf.pool = { query: sinon.fake.resolves({ rows: [] }) }
      q = new Query({ name: 'q', generate: () => {} })
    })

    it('should run its hooks', async () => {
      const beforeHook = sinon.fake()
      const afterHook = sinon.fake()
      q.hooks.add('before', beforeHook)
      q.hooks.add('after', afterHook)
      await q.run(new Params({ conf }))
      expect(beforeHook.callCount).to.be(1)
      expect(afterHook.callCount).to.be(1)
    })

    it('should give itself as a parameter', async () => {
      let qAsPar;
      q.hooks.add('before', ({ query }) => qAsPar = query)
      await q.run(new Params({ conf }))
      expect(qAsPar).to.be(q)
    })

    it('should pass the response to the after-hooks', async () => {
      let result;
      q.hooks.add('after', ({ res }) => result = res)
      await q.run(new Params({ conf }))
      expect(result).to.be.ok()
    })

    it('should attempt to return transformed entities by default')
    it('should return the entities transformed with a custom function if given')

    describe('should throw an error', function () {
      specify('on hook failure', async () => {
        q.hooks.add('after', sinon.fake.throws('Failing hook'))
        await q.run(new Params({ conf }))
          .then(() => { throw new Error('Running query should have thrown an error') })
          .catch(() => {})
      })

      specify('on SQL query failure', async () => {
        conf.pool.query = sinon.fake.rejects('Failing query')
        await q.run(new Params({ conf }))
          .then(() => { throw new Error('Running query should have thrown an error') })
          .catch(() => {})
      })
    })

    after(() => sinon.restore())
  })
})


describe('Perseest.Query.Map', function() {
  describe('creating', function() {
    describe('should be successful', function() {
      specify('with no initial queries', () => new Query.Map())
      specify('with an iterable collection of valid queries', () =>
        new Query.Map([ new Query({
          name: 'q',
          type: 'boolean',
          generate: () => {}
        }) ]))
    })

    describe('should fail', function() {
      specify('with a non-iterable collection of valid queries', () =>
        expect(() => new Query.Map({
          a: new Query({ name: 'q', type: 'boolean', generate: () => {} }),
          b: new Query({ name: 'q', type: 'boolean', generate: () => {} })
        })).to.throwError())

      specify('with an iterable collection of invalid queries', () =>
        expect(() => new Query.Map([ 'abc', { a: 1 }])).to.throwError())
    })
  })

  describe('adding', function() {
    let map;
    beforeEach(() => map = new Query.Map())

    describe('should be successful', function() {
      specify('with valid name/query entry', () => {
        expect(map.size).to.be(0)
        map.set('q', new Query({ name: 'q', type: 'boolean', generate: () => {} }))
        expect(map.size).to.be(1)
      })

      specify('with valid query instance', () => {
        expect(map.size).to.be(0)
        map.add(new Query({ name: 'q', type: 'boolean', generate: () => {} }))
        expect(map.size).to.be(1)
      })

      specify('with valid parameters for in-place creation', () => {
        expect(map.size).to.be(0)
        map.create({ name: 'q', type: 'boolean', generate: () => {} })
        expect(map.size).to.be(1)
      })
    })

    describe('should fail', function() {
      const q = new Query({ name: 'q', type: 'boolean', generate: () => {} })

      specify('with invalid name', () => {
        expect(map.size).to.be(0)
        expect(() => map.set('@!.-', q)).to.throwError();
        expect(() => map.set('', q)).to.throwError();
        expect(() => map.set(undefined, q)).to.throwError();
        expect(() => map.set(q)).to.throwError();
        expect(map.size).to.be(0)
      })

      specify('with invalid query instance, using set()', () => {
        expect(map.size).to.be(0)
        expect(() => map.set('q', null)).to.throwError();
        expect(() => map.set('q', 'abc')).to.throwError();
        expect(() => map.set('q', { a: 1, b: '2' })).to.throwError();
        expect(map.size).to.be(0)
      })

      specify('with invalid query instance, using add()', () => {
        expect(map.size).to.be(0)
        expect(() => map.add('boh')).to.throwError()
        expect(() => map.add({ a: 1, c: 4 })).to.throwError()
        expect(() => map.add(null)).to.throwError()
        expect(map.size).to.be(0)
      })

      specify('with invalid parameters for in-place creation', () => {
        expect(() => map.create()).to.throwError();
        expect(() => map.create({ a: 'abc', d: 'def' })).to.throwError();
      })
    })
  })
})


describe('Perseest.Query.TypeMap', function() {
  describe('creating', function() {
    describe('should be successful', function() {
      specify('with no initial types', () => new Query.TypeMap())
      specify('with an iterable collection of valid type', () =>
        new Query.TypeMap([ ['dummy', () => 'dummy'] ]))
    })

    describe('should fail', function() {
      specify('with a non-iterable collection of valid types', () =>
        expect(() => new Query.TypeMap({
          boh: ['dummy1', () => {}],
          mah: ['dummy2', () => {}],
        })).to.throwError())

      specify('with an iterable collection of invalid types', () => {
        expect(() => new Query.TypeMap([ [null, () => {}] ])).to.throwError()
        expect(() => new Query.TypeMap([ ['type_1', null] ])).to.throwError()
        expect(() => new Query.TypeMap([ ['t2', { z: 0 }] ])).to.throwError()
        expect(() => new Query.TypeMap([ [null, null] ])).to.throwError()
      })
    })
  })

  describe('adding entries', function() {
    let map;
    beforeEach(() => map = new Query.TypeMap())

    it('should be successful with valid name and transformer', () => {
      expect(map.size).to.be(0)
      map.set('dummy', () => 'dummy')
      expect(map.size).to.be(1)
    })

    describe('should fail', function() {
      specify('with invalid name', () => {
        expect(map.size).to.be(0)
        expect(() => map.set(null, () => 'dummy')).to.throwError()
        expect(() => map.set('', () => 'dummy')).to.throwError()
        expect(map.size).to.be(0)
      })

      specify('with invalid transformer', () => {
        expect(map.size).to.be(0)
        expect(() => map.set('dummy', 'dummy')).to.throwError()
        expect(() => map.set('dummy', { ret: 'dummy' })).to.throwError()
        expect(() => map.set('dummy', null)).to.throwError()
        expect(() => map.set('dummy', undefined)).to.throwError()
        expect(map.size).to.be(0)
      })
    })
  })
})
