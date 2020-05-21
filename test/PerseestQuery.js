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
