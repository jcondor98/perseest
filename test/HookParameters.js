// perseest - Test Unit for query hook parameters
// Uses mocha as the main testing framework and expect.js as the assert library
// jcondor (Paolo Lucchesi)
'use strict'
const expect = require('expect.js')
const Perseest = require('../lib/perseest')
const { Mock } = require('./help/mock')

describe('Query hook parameters', function () {
  let mocky
  beforeEach(() => mocky = new Mock())

  it('should be successfully created with any argument', function () {
    // TODO: Make other tests
    expect(() => new Perseest.HookParameters({ conf: Mock.db, ent: mocky }))
      .to.not.throwError()
  })

  describe('getting columns', function () {
    it('should return just some if they are given', function () {
      const columns = ['a', 'b']
      const params = new Perseest.HookParameters({ conf: Mock.db, ent: mocky, columns })
      expect(params.columns).to.eql(columns)
    })

    it('should return all if they are not given', function () {
      const params = new Perseest.HookParameters({ conf: Mock.db, ent: mocky })
      expect((new Set(params.columns)).equals(new Set(Mock.db.columns)))
        .to.be(true)
    })
  })

  describe('getting column values', function () {
    it('should return related ones if just columns are given', () => {
      const columns = [[...Mock.db.columns][0]]
      const params = new Perseest.HookParameters({ conf: Mock.db, ent: mocky, columns })
      expect(params.columns).to.eql(columns)
      expect(params.values).to.have.length(columns.length)
      expect(params.values).to.eql(columns.map(c => mocky[c]))
    })

    it('should return all if no columns or values are given', () => {
      const params = new Perseest.HookParameters({ conf: Mock.db, ent: mocky })
      expect((new Set(params.values))
        .equals(new Set([...Mock.db.columns].map(c => mocky[c]))))
        .to.be(true)
    })

    it('should return given ones if both columns and values are given', () => {
      const [cols, vals] = [['a', 'b', 'c'], [1, 2, 3]]
      const params = new Perseest.HookParameters({ conf: Mock.db, ent: mocky, columns: cols, values: vals })
      expect(params.columns).to.eql(cols)
      expect(params.values).to.eql(vals)
    })
  })

  describe('getting key', function () {
    it('should return primary key name if none was given', () => {
      const params = new Perseest.HookParameters({ conf: Mock.db, ent: mocky })
      expect(params.key).to.equal(Mock.db.primaryKey)
    })

    it('should return the same name if given', () => {
      const params = new Perseest.HookParameters({ conf: Mock.db, ent: mocky, key: 'uniq' })
      expect(params.key).to.equal('uniq')
    })
  })

  describe('getting key value', function () {
    it('should return primary key value if nothing was given', () => {
      const params = new Perseest.HookParameters({ conf: Mock.db, ent: mocky })
      expect(params.key).to.equal(Mock.db.primaryKey)
      expect(params.kval).to.equal(mocky[Mock.db.primaryKey])
    })

    it('should return the correct key value if just key was given', () => {
      const params = new Perseest.HookParameters({ conf: Mock.db, ent: mocky, key: 'uniq' })
      expect(params.key).to.equal('uniq')
      expect(params.kval).to.equal(mocky.uniq)
    })

    it('should return the passed value if both key and value were given', () => {
      const params = new Perseest.HookParameters({ conf: Mock.db, ent: mocky, key: 'uniq', kval: 'abcde' })
      expect(params.key).to.equal('uniq')
      expect(params.kval).to.equal('abcde')
    })
  })
})
