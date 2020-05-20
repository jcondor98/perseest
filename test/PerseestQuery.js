// perseest - Test Unit for queries
// Uses mocha as the main testing framework and expect.js as the assert library
// jcondor (Paolo Lucchesi)
'use strict'
const expect = require('expect.js')
const Query = require('../lib/PerseestQuery')

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

describe('A query object', function () {
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
        negativeTestCases.concat(falsyTestCases)
          .concat([['a string', 'abc']]).forEach(([testCase, obj]) =>
            specify(testCase, () => {
              expect(() => new Query({ name: 'q', generate: obj }))
                .to.throwError()
            }))
      })

      describe('with transformer being', function () {
        negativeTestCases.concat([['a string', 'abc']]).forEach(([testCase, obj]) =>
          specify(testCase, () => {
            expect(() => new Query({ name: 'q', generate: () => {}, transform: obj }))
              .to.throwError()
          }))
      })
    })
  })

  describe('when run', function () {
    it('should run its hooks')
    it('should give its name as a parameter')
    it('should pass the response to the after-hooks')
    it('should attempt to return transformed entities by default')
    it('should return the entities transformed with a custom function if given')
    describe('should throw an error', function () {
      specify('on hook failure')
      specify('on SQL query failure')
    })
  })
})
