// perseest - Test Unit for Perseest.Config
// jcondor (Paolo Lucchesi)
'use strict'
const expect = require('expect.js')
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
