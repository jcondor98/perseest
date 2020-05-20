// perseest - Test Unit for the perseest class/mixin
// Uses mocha as the main testing framework and expect.js as the assert library
// jcondor (Paolo Lucchesi)
'use strict'
const expect = require('expect.js')
const sinon = require('sinon')
const { Mock } = require('./help/mock')

// Import environment variables
require('dotenv').config({ path: './environment/test.env' })

before(async () => {
  Mock.db.setup(process.env.POSTGRES_URI)
  await Mock.db.pool.query('DROP TABLE Mockies').catch(() => {}) // Ignore errors
  await Mock.db.pool.query(
`CREATE TABLE Mockies(
  id INTEGER PRIMARY KEY, 
  uniq VARCHAR UNIQUE NOT NULL,
  msg VARCHAR,
  msg2 VARCHAR);
`)

  await Mock.db.pool.query('DELETE FROM Mockies')
})

after(async () => await Mock.db.cleanup())

describe('A class extending Perseest.Class', function () {
  let mocky
  beforeEach(() => {
    mocky = new Mock()
  })

  describe('when fetched', function () {
    specify('by existent id should return an existent entity', async () => {
      try {
        await mocky.save()
        const mocky2 = await Mock.fetch('id', mocky.id)
        expect(mocky2).to.not.equal(null)
        expect(mocky2.id).to.equal(mocky.id)
      } catch (err) {
        throw err
      }
    })

    describe('should throw an error', function () {
      specify('on inexistent id column name', done => {
        Mock.fetch('blerulerule', 'DOH!')
          .then(user => done(new Error(`Fetched user ${user}`)))
          .catch(() => done())
      })

      specify('if querying the database fails', async () => {
        const fake = sinon.fake.rejects('Query error')
        sinon.replace(Mock.db.pool, 'query', fake)
        try {
          await Mock.fetch('id', mocky.id)
        } catch (err) {
          sinon.restore()
          return
        }
        sinon.restore()
        throw new Error('Fetching user should have thrown an error')
      })
    })
  })

  describe('when saved', function () {
    specify('should be successful if consistent', async () => {
      try {
        expect(mocky.exists).to.be(false)
        await mocky.save()
        expect(mocky.exists).to.be(true)
      } catch (err) { throw err }
    })

    describe('should throw an error', function () {
      specify('if falling back to update() fails', async () => {
        const fake = sinon.fake.rejects('Rejecting update method')
        sinon.replace(mocky, 'update', fake)
        mocky.exists = true
        try {
          await mocky.save()
        } catch (err) {
          expect(fake.callCount).to.be(1)
          sinon.restore()
          return
        }
        throw new Error('User should not have been saved/updated')
      })

      specify('with fields violating constraints', done => {
        mocky.save()
          .then(() => {
            mocky.exists = false
            return mocky.save()
          }).then(() => done(new Error('User should not have been saved')))
          .catch(() => done())
      })
    })

    specify('should fall back to update() if existent', async () => {
      const fake = sinon.fake.resolves(true)
      sinon.replace(mocky, 'update', fake)
      mocky.exists = true
      expect(await mocky.save()).to.be(true)
      expect(fake.callCount).to.be(1)
      sinon.restore()
    })
  })

  describe('when updated', function () {
    describe('should be successful', function () {
      beforeEach(async () =>
        await mocky.save().then(() => {}).catch(err => { throw err }))

      specify('with no arguments passed (i.e. all columns)', async () => {
        try {
          mocky.msg = 'ciaone'
          await mocky.update()
          const mocky2 = await Mock.fetch('id', mocky.id)
          expect(mocky2).to.not.equal(null)
          expect(mocky2.id).to.equal(mocky.id)
          expect(mocky2.msg).to.equal(mocky.msg)
        } catch (err) {
          throw err
        }
      })

      specify('with a single argument passed as a string', async () => {
        try {
          mocky.msg = 'ciaone'
          mocky.uniq = 'fhsghdafvgbhfwa'
          await mocky.update('msg')
          const mocky2 = await Mock.fetch('id', mocky.id)
          expect(mocky2).to.not.equal(null)
          expect(mocky2.id).to.equal(mocky.id) // Not updated
          expect(mocky2.msg).to.equal(mocky.msg)
          expect(mocky2.uniq).to.not.equal(mocky.uniq) // Should not be updated
        } catch (err) {
          throw err
        }
      })

      specify('with arguments passed as rest parameters', async () => {
        try {
          mocky.msg = 'ciaone'
          mocky.msg2 = 'megaprontone'
          mocky.uniq = 'fhsghdafvgbhfwa'
          await mocky.update('msg', 'msg2')
          const mocky2 = await Mock.fetch('id', mocky.id)
          expect(mocky2).to.not.equal(null)
          expect(mocky2.id).to.equal(mocky.id) // Not updated
          expect(mocky2.msg).to.equal(mocky.msg)
          expect(mocky2.msg2).to.equal(mocky.msg2)
          expect(mocky2.uniq).to.not.equal(mocky.uniq) // Should not be updated
        } catch (err) {
          throw err
        }
      })

      specify('with arguments passed as an iterable collection', async () => {
        try {
          mocky.msg = 'ciaone'
          mocky.msg2 = 'megaprontone'
          mocky.uniq = 'fhsghdafvgbhfwa'
          await mocky.update(new Set(['msg', 'msg2']))
          const mocky2 = await Mock.fetch('id', mocky.id)
          expect(mocky2).to.not.equal(null)
          expect(mocky2.id).to.equal(mocky.id) // Not updated
          expect(mocky2.msg).to.equal(mocky.msg)
          expect(mocky2.msg2).to.equal(mocky.msg2)
          expect(mocky2.uniq).to.not.equal(mocky.uniq) // Should not be updated
        } catch (err) {
          throw err
        }
      })
    })

    describe('should throw an error', function () {
      specify('with fields violating constraints', async () => {
        const mocky2 = new Mock()
        await mocky.save()
        await mocky2.save()
        mocky2.uniq = mocky.uniq
        let failed = false
        try {
          await mocky2.update('uniq')
          failed = true
        } catch (err) {
          if (failed) { throw new Error('User should not have been saved') }
        }
      })

      specify('with column names not being strings', done => {
        mocky.save()
          .then(() => mocky.update(() => {}))
          .then(() => done(new Error('User should not have been saved')))
          .catch(() => done())
      })

      specify('with column names not being present', done => {
        mocky.save()
          .then(() => mocky.update('DOH'))
          .then(() => done(new Error('User should not have been saved')))
          .catch(() => done())
      })
    })
  })

  describe('when deleted', function () {
    specify('by existent id should return true and be removed', async () => {
      try {
        await mocky.save()
        expect(await Mock.fetch('id', mocky.id)).to.not.be(null)
        expect(await mocky.delete()).to.be(true)
        expect(await Mock.fetch('id', mocky.id)).to.be(null)
      } catch (err) {
        throw err
      }
    })

    specify('by valid but inexistent id should return false', async () => {
      try {
        mocky.exists = true // Do not save mocky
        expect(await Mock.fetch('id', mocky.id)).to.be(null)
        expect(await mocky.delete()).to.be(false)
      } catch (err) {
        throw err
      }
    })

    describe('should throw an error', function () {
      specify('if querying the database fails', async () => {
        const fake = sinon.fake.rejects('Query error')
        sinon.replace(Mock.db.pool, 'query', fake)
        try {
          await Mock.delete('id', mocky.id)
        } catch (err) {
          sinon.restore()
          return
        }
        sinon.restore()
        throw new Error('Fetching user should have thrown an error')
      })

      specify('on invalid id column name', done => {
        Mock.delete('homersimpson', 'doh')
          .then(res => done(new Error(`User was deleted with result ${res}`)))
          .catch(() => done())
      })
    })
  })
})
