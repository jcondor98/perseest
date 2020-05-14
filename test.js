// perseest - Test Unit
// Uses mocha as the main testing framework and expect.js as the assert library
const expect = require('expect.js');
const Perseest = require('./perseest');
const { PerseestFactory, ConfigFactory } = require('./factories');
const { range } = require('./helpers');

// Setup factories
ConfigFactory.init = {
  table: 'Mockies',
  primaryKey: 'id',
  columns: ['msg', 'msg2'],
  ids: ['uniq']
};

class Mock extends Perseest.Class {
  constructor({ id=null, msg=null, msg2=null, uniq=null } = {}) {
    super();
    this.id = id || this.constructor.id++;
    this.msg = msg || 'abcde';
    this.msg2 = msg2 || 'fghijk';
    this.uniq = uniq || this.id;
  }

  static id = 0;
  static db = ConfigFactory.create();
}

before(async () => {
  Mock.db.setup(process.env['PG_TEST_URI']);
  await Mock.db.pool.query('DROP TABLE Mockies').catch(() => {}); // Ignore errors
  await Mock.db.pool.query(
`CREATE TABLE Mockies(
  id INTEGER PRIMARY KEY, 
  uniq VARCHAR UNIQUE NOT NULL,
  msg VARCHAR,
  msg2 VARCHAR);
  `);

  await Mock.db.pool.query('DELETE FROM Mockies');
});

after(async () => await Mock.db.cleanup());


describe('Perseest.Config', function() {
  specify('should be created with good parameters', () =>
    expect(() => ConfigFactory.create()).to.not.throwError(console.error));
    
  describe('should throw an error when created with', function() {
    specify('blank table name', () =>
      expect(() => ConfigFactory.create({ table: '' })).to.throwError());

    specify('non-string table name', () =>
      expect(() => ConfigFactory.create({ table: {a:1}})).to.throwError());

    specify('blank primary key', () =>
      expect(() => ConfigFactory.create({ primaryKey: '' })).to.throwError());

    specify('non-string primary key', () =>
      expect(() => ConfigFactory.create({ primaryKey: {a: 321321} }))
        .to.throwError());

    for (attr of ['ids', 'columns'])
      specify(`non-iterable ${attr} collection`, () => {
        const args = Object.defineProperty({}, attr, {a:1,b:2});
        expect(ConfigFactory.create).withArgs(args).to.throwError();
      });
  });
});


describe('A class extending Perseest.Class', function() {
  let mocky;
  beforeEach(async () => {
    mocky = new Mock();
  });


  describe('when fetched', function() {
    specify('by existent id should return an existent entity', async () => {
      try {
        await mocky.save();
        const mocky2 = await Mock.fetch('id', mocky.id);
        expect(mocky2).to.not.equal(null);
        expect(mocky2.id).to.equal(mocky.id);
      } catch (err) {
        throw err;
      }
    });

    specify('fetching by inexistent id should throw an error', done => {
      Mock.fetch('blerulerule', 'DOH!')
        .then(user => done(new Error(`Fetched user ${user}`)))
        .catch(() => done());
    });
  });


  describe('when saved', function() {
    specify('should be successful if consistent', async () => {
      try {
        expect(mocky.exists).to.be(false);
        await mocky.save();
        expect(mocky.exists).to.be(true);
      }
      catch (err) { throw err; }
    });

    specify('with fields violating constraints should throw an error', done => {
      mocky.save()
        .then(() => {
          mocky.exists = false;
          return mocky.save();
        }).then(() => done(new Error('User should not have been saved')))
        .catch(() => done());
    });
  });


  describe('when updated', function() {
    describe('if consistend should be successful ', function() {
      beforeEach(async () =>
        await mocky.save().then(()=>{}).catch(err=> { throw err }));

      specify('with no arguments passed (i.e. all columns)', async () => {
        try {
          mocky.msg = 'ciaone';
          await mocky.update();
          const mocky2 = await Mock.fetch('id', mocky.id);
          expect(mocky2).to.not.equal(null);
          expect(mocky2.id).to.equal(mocky.id);
          expect(mocky2.msg).to.equal(mocky.msg);
        } catch(err) {
          throw err;
        }
      });

      specify('with a single argument passed as a string', async () => {
        try {
          mocky.msg = 'ciaone';
          mocky.uniq = 'fhsghdafvgbhfwa'
          await mocky.update('msg');
          const mocky2 = await Mock.fetch('id', mocky.id);
          expect(mocky2).to.not.equal(null);
          expect(mocky2.id).to.equal(mocky.id); // Not updated
          expect(mocky2.msg).to.equal(mocky.msg);
          expect(mocky2.uniq).to.not.equal(mocky.uniq); // Should not be updated
        } catch(err) {
          throw err;
        }
      });

      specify('with arguments passed as rest parameters', async () => {
        try {
          mocky.msg = 'ciaone';
          mocky.msg2 = 'megaprontone';
          mocky.uniq = 'fhsghdafvgbhfwa'
          await mocky.update('msg', 'msg2');
          const mocky2 = await Mock.fetch('id', mocky.id);
          expect(mocky2).to.not.equal(null);
          expect(mocky2.id).to.equal(mocky.id); // Not updated
          expect(mocky2.msg).to.equal(mocky.msg);
          expect(mocky2.msg2).to.equal(mocky.msg2);
          expect(mocky2.uniq).to.not.equal(mocky.uniq); // Should not be updated
        } catch(err) {
          throw err;
        }
      });

      specify('with arguments passed as an iterable collection', async () => {
        try {
          mocky.msg = 'ciaone';
          mocky.msg2 = 'megaprontone';
          mocky.uniq = 'fhsghdafvgbhfwa'
          await mocky.update(new Set(['msg', 'msg2']));
          const mocky2 = await Mock.fetch('id', mocky.id);
          expect(mocky2).to.not.equal(null);
          expect(mocky2.id).to.equal(mocky.id); // Not updated
          expect(mocky2.msg).to.equal(mocky.msg);
          expect(mocky2.msg2).to.equal(mocky.msg2);
          expect(mocky2.uniq).to.not.equal(mocky.uniq); // Should not be updated
        } catch(err) {
          throw err;
        }
      });
    });

    specify('with fields violating constraints should throw an error', done => {
      mocky.save()
        .then(() => mocky.update('uniq'))
        .then(() => (new Mock({ uniq: mocky.id })).save())
        .then(() => done(new Error('User should not have been saved')))
        .catch(() => done());
    });
  });


  describe('when deleted', function() {
    specify('by existent id should return true and be removed', async () => {
      try {
        await mocky.save();
        expect(await Mock.fetch('id', mocky.id)).to.not.be(null);
        expect(await mocky.delete()).to.be(true);
        expect(await Mock.fetch('id', mocky.id)).to.be(null);
      } catch (err) {
        throw err;
      }
    });

    specify('by valid but inexistent id should return false', async () => {
      try { // Do not save mocky
        expect(await Mock.fetch('id', mocky.id)).to.be(null);
        expect(await mocky.delete()).to.be(false);
      } catch (err) {
        throw err;
      }
    });

    specify('by invalid id should throw an error', done => {
      Mock.delete('homersimpson', 'doh')
        .then(res => done(new Error(`User was deleted with result ${res}`)))
        .catch(() => done());
    });
  });
});


describe('Query hooks', function() {
  let Local;
  beforeEach(() => Local = PerseestFactory.createClass());

  it('should initially be empty if none is specified', () => {
    for (moment of ['before', 'after']) {
      expect(Local.db.hooks).to.have.property(moment);
      expect(Object.getOwnPropertyNames(Local.db.hooks[moment]))
        .to.have.length(0);
    }
  });

  describe('should be added successfully', function() {
    specify('for a single hook', () => {
      Local.db.addHook('before', 'something', () => {});
      expect(Local.db.hooks.before.something).to.be.an('array');
      expect(Local.db.hooks.before.something).to.have.length(1);
    });

    specify('for multiple hooks', () => {
      const MULT = 8;
      const rnd = Math.ceil((Math.random() + 0.1) * MULT - 1);
      for (const n of range(0, rnd-1))
        Local.db.addHook('before', 'something', () => {});
      expect(Local.db.hooks.before.something).to.be.an('array');
      expect(Local.db.hooks.before.something).to.have.length(rnd);
    });
  });

  describe('should not be added successfully', function() {
    describe('when they are', function() {
      [ ['an object', { a: 'b' }],
        ['a string',  'ciaone'],
        ['an array',  ['a', 'b', 'c']],
        ['undefined', undefined],
        ['null',  null],
        ['falsy', false]
      ].forEach(([testCase,obj]) => {
        specify(testCase, () =>
          expect(() => Local.db.addHook('after', 'something', obj))
            .to.throwError());
      });
    });

    describe('when temporal trigger is invalid', () =>
      expect(() => Local.db.addHook('sometimes', 'something', () => {}))
        .to.throwError());
  });

  it('should be ran successfully and in order when called', async () => {
    const MULT = 8;
    const rnd = Math.ceil((Math.random() + 0.1) * MULT - 1) + 1;
    let executed = Array(rnd);
    for (const n of range(0, rnd-1))
      Local.db.addHook('before', 'doh', () => executed[n] = n);
    expect(Local.db.hooks.before.doh).to.have.length(rnd)

    try {
      await Local.db.runHooks('before', 'doh');
    } catch (err) {
      throw err;
    }

    expect(executed).to.eql([...range(0,rnd-1)]);
  });

  describe('flushing', function() {
    beforeEach(() => {
      for (const when of ['before', 'after']) {
        Local.db.addHook(when, 'alice', () => {});
        Local.db.addHook(when, 'bob', () => {});
      }
    });

    it('should remove all hooks without arguments', function() {
      Local.db.flushHooks();
      expect(Local.db.hooks.before).to.eql({});
      expect(Local.db.hooks.after).to.eql({});
    });

    it('should remove related hooks only with trigger', function() {
      Local.db.flushHooks(null, 'bob');
      expect(Local.db.hooks.before.alice).to.not.be.empty();
      expect(Local.db.hooks.after.alice).to.not.be.empty();
      expect(Local.db.hooks.before).to.not.have.property('bob');
      expect(Local.db.hooks.after).to.not.have.property('bob');
    });

    it('should remove related hooks only with moment', function() {
      Local.db.flushHooks('before');
      expect(Local.db.hooks.before).to.be.empty();
      expect(Local.db.hooks.after).to.not.be.empty();
    });

    it('should remove related hooks with trigger and moment', function() {
      Local.db.flushHooks('before', 'alice');
      expect(Local.db.hooks.before).to.not.have.property('alice');
      expect(Local.db.hooks.after.alice).to.not.be.empty();
      expect(Local.db.hooks.before.bob).to.not.be.empty();
      expect(Local.db.hooks.after.bob).to.not.be.empty();
    });

    describe('should throw an error with', function() {
      specify('non-string \'when\'', () =>
        expect(() => Local.db.flushHooks({})).to.throwError());

      specify('non-string trigger', () =>
        expect(() => Local.db.flushHooks('before', () => {}).to.throwError()));

      specify('\'when\' not within [\'before\',\'after\']', () =>
        expect(() => Local.db.flushHooks('abc').to.throwError()));
    });
  });
});
