// perseest - Test Unit for query hooks
// Uses mocha as the main testing framework and expect.js as the assert library
// jcondor (Paolo Lucchesi)
'use strict'
const expect = require('expect.js')
const Hooks = require('../lib/PerseestHooks')
const { range } = require('../lib/helpers')
const sinon = require('sinon')

const negativeTestCases = [
  ['a generic string', 'ciaone'],
  ['an array', ['a', 'b', 'c']],
  ['an object', { a: 'b' }]
]

const falsyTestCases = [
  ['an empty string', ''],
  ['undefined', undefined],
  ['falsy', false],
  ['null', null]
]

describe('PerseestHooks', function () {
  let hooks
  beforeEach(() => hooks = new Hooks())

  it('should have empty hooks stacks when created', () => {
    for (const t of ['before', 'after']) {
      expect(hooks[t]).to.be.an(Array)
      expect(hooks[t]).to.be.empty()
    }
  })

  describe('adding', function () {
    describe('should be successful', function () {
      specify('with no temporal trigger', () => {
        expect(() => hooks.add(() => {})).to.not.throwError()
        expect(hooks.before).to.have.length(1)
        expect(hooks.after).to.have.length(1)
      })

      specify('as a before-hook', () => {
        hooks.add('before', () => {})
        expect(hooks.before).to.have.length(1)
        expect(hooks.after).to.be.empty()
      })

      specify('as an after-hook', () => {
        hooks.add('after', () => {})
        expect(hooks.after).to.have.length(1)
        expect(hooks.before).to.be.empty()
      })
    })

    describe('should fail', function () {
      describe('on hook being', function () {
        negativeTestCases.concat(falsyTestCases).forEach(([testCase, obj]) => {
          specify(testCase, () =>
            expect(() => hooks.add('after', obj)).to.throwError())
        })
      })

      describe('on temporal trigger being', () => {
        negativeTestCases.forEach(([testCase, obj]) =>
          specify(testCase, () =>
            expect(() => hooks.add(obj, () => {})).to.throwError()))
      })
    })
  })

  describe('flushing', function () {
    beforeEach(() => {
      const LIMIT = 8
      hooks.flush()
      for (const n of range(1, LIMIT)) { hooks.add(() => {}) }
    })

    it('should remove all hooks without temporal trigger', () => {
      hooks.flush()
      expect(hooks.before).to.be.empty()
      expect(hooks.after).to.be.empty()
    })

    it('should remove related hooks with good temporal trigger', () => {
      hooks.flush('after')
      expect(hooks.before).to.not.be.empty()
      expect(hooks.after).to.be.empty()
    })

    it('should fail with bad temporal trigger', () => {
      expect(() => hooks.flush('doh')).to.throwError()
    })
  })

  describe('running', function () {
    const LIMIT = 8
    let executed
    beforeEach(() => {
      hooks.flush()
      sinon.restore()
      for (const n of range(0, LIMIT - 1)) {
        hooks.add('before', () => executed.before[n] = n)
        hooks.add('after', () => executed.after[n] = n)
      }
      executed = {
        before: Array(LIMIT).fill(null),
        after: Array(LIMIT).fill(null)
      }
    })

    it('should run all hooks without temporal trigger', async () => {
      try { await hooks.run() } catch (err) { throw err }
      expect(executed.before).to.eql([...range(0, LIMIT - 1)])
      expect(executed.after).to.eql([...range(0, LIMIT - 1)])
    })

    it('should run related hooks with good temporal trigger', async () => {
      try { await hooks.run('before') } catch (err) { throw err }
      expect(executed.before).to.eql([...range(0, LIMIT - 1)])
      expect(executed.after.filter(e => e !== null)).to.be.empty()
    })

    it('should fail with bad temporal trigger', async () => {
      try { await hooks.run('doh') } catch (err) { return }
      throw new Error('Running hooks should have thrown an error')
    })

    it('should fail with a failing hook', async () => {
      const fake = sinon.fake.throws('Failing hook')
      hooks.add(fake)
      try { await hooks.run() } catch (err) { return }
      throw new Error('Running hooks should have thrown an error')
    })

    it('should consider an object as params and not as temporal trigger', async () => {
      try { await hooks.run({ a: 1, b: '2' }) } catch (err) { throw err }
      expect(executed.before).to.eql([...range(0, LIMIT - 1)])
      expect(executed.after).to.eql([...range(0, LIMIT - 1)])
    })

    describe('with async hooks', function () {
      it('should be successful if hooks run without errors', async () => {
        const fake = sinon.fake.resolves()
        hooks.add(fake)
        try { await hooks.run() } catch (err) { throw err }
      })

      it('should fail if a hook fails', async () => {
        const fake = sinon.fake.rejects('Failing async hook')
        hooks.add(fake)
        try { await hooks.run() } catch (err) { return }
        throw new Error('Running hooks should have thrown an error')
      })
    })
  })
})
