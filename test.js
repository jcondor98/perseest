const expect = require('expect.js');
const Persistent = require('./perseest');

class Mock extends Persistent.Class {
  constructor({ id=null, msg=null, uniq=null } = {}) {
    super();
    this.id = id || this.constructor.id++;
    this.msg = msg || 'abcde';
    this.uniq = uniq || this.id;
  }

  static id = 0;

  static db = Persistent.composeDBObject({
    persistent: ['id', 'msg', 'uniq'],
    identifiers: ['id', 'uniq'],
    primaryKey: 'id',

    queries: {
      save: ent => ({
        text: 'INSERT INTO Mockies VALUES ($1,$2,$3)',
        values: [ent.id, ent.msg, ent.uniq]
      }),
      fetch: (key,val) => ({
        text: `SELECT * FROM Mockies WHERE ${key} = $1`,
        values: [val]
      }),
      update: (ent,keys) => ({
        text: 'UPDATE Mockies SET ' +
          keys.map((k,idx) => `${k} = $${idx+1}`).join(', ') +
          ` WHERE id = $${keys.length + 1};`,
        values: keys.map(k => ent[k]).concat(ent[Mock.db.primaryKey])
      }),
      delete: (key,val) => ({
        text: `DELETE FROM Mockies WHERE ${key} = $1`,
        values: [val]
      })
    },
  });

}

before(async () => {
  Mock.dbSetup(process.env['PG_TEST_URI']);
  await Mock.db.pool.query('DELETE FROM Mockies');
});

after(async () => await Mock.dbCleanup());


describe('A class implementing persistency', function() {
  let mocky;
  beforeEach(async () => {
    mocky = new Mock();
  });

  describe('should be successfully', function() {
    specify('saved with consistent fields', async () => {
      try {
        expect(mocky.exists).to.be(false);
        await mocky.save();
        expect(mocky.exists).to.be(true);
      }
      catch (err) { throw err; }
    });

    specify('updated with consistent fields', async () => {
      try {
        await mocky.save();
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

    specify('fetched by existent identifier', async () => {
      try {
        await mocky.save();
        const mocky2 = await Mock.fetch('id', mocky.id);
        expect(mocky2).to.not.equal(null);
        expect(mocky2.id).to.equal(mocky.id);
      } catch (err) {
        throw err;
      }
    });

    specify('deleted by existent identifier', async () => {
      try {
        await mocky.save();
        expect(await Mock.fetch('id', mocky.id)).to.not.be(null);
        await mocky.delete();
        expect(await Mock.fetch('id', mocky.id)).to.be(null);
      } catch (err) {
        throw err;
      }
    });
  });


  describe('should throw an error', function() {
    specify('when saving with fields violating some constraint', done => {
      mocky.save()
        .then(() => {
          mocky.exists = false;
          return mocky.save();
        }).then(() => done(new Error('User should not have been saved')))
        .catch(() => done());
    });

    specify('when updating fields violating some constraint', done => {
      mocky.save()
        .then(() => mocky.update('uniq'))
        .then(() => (new Mock({ uniq: mocky.id })).save())
        .then(() => done(new Error('User should not have been saved')))
        .catch(() => done());
    });

    specify('when fetching by inexistent field', done => {
      Mock.fetch('blerulerule', 'DOH!')
        .then(user => done(new Error(`Fetched user ${user}`)))
        .catch(() => done());
    });
  });
});


describe('Query hooks', function() {
  let Local;
  beforeEach(() => Local = Persistent.Mixin());


  it('should initially be empty if none is specified', () => {
    for (moment of ['before', 'after']) {
      expect(Local.db.hooks).to.have.property(moment);
      expect(Object.getOwnPropertyNames(Local.db.hooks[moment]))
        .to.have.length(0);
    }
  });

  describe('should be added successfully', function() {
    specify('for a single hook', () => {
      Local.addHook('before', 'something', () => {});
      expect(Local.db.hooks.before.something).to.be.an('array');
      expect(Local.db.hooks.before.something).to.have.length(1);
    });

    specify('for multiple hooks', () => {
      const LIMIT = 16;
      const rnd = Math.ceil((Math.random() + 0.1) * LIMIT - 1);
      for (const n of range(0,rnd))
        Local.addHook('before', 'something', () => {});
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
          expect(() => Local.addHook('after', 'something', obj))
            .to.throwError());
      });
    });

    describe('when temporal trigger is invalid', () =>
      expect(() => Local.addHook('sometimes', 'something', () => {}))
        .to.throwError());
  });

  it('should be ran successfully and in order when called', async () => {
    const LIMIT = 8;
    const rnd = Math.ceil((Math.random() + 0.1) * LIMIT - 1);
    let executed = Array(rnd);
    for (const n of range(0, rnd))
      Local.addHook('before', 'doh', () => executed[n] = n);
    expect(Local.db.hooks.before.doh).to.have.length(rnd)

    try {
      await Local.runHooks('before', 'doh');
    } catch (err) {
      throw err;
    }

    expect(executed).to.eql([...range(0,rnd)]);
  });
});


function *range(start, stop) {
  for (let i=start; i < stop; ++i)
    yield i;
}
