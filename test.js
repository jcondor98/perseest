// perseest - Test Unit
// Uses mocha as the main testing framework and expect.js as the assert library
const expect = require('expect.js');
const Perseest = require('./perseest');

class Mock extends Perseest.Class {
  constructor({ id=null, msg=null, uniq=null } = {}) {
    super();
    this.id = id || this.constructor.id++;
    this.msg = msg || 'abcde';
    this.uniq = uniq || this.id;
  }

  static id = 0;

  static db = new Perseest.Config('Mockies', 'id', {
    columns: ['msg'],
    ids: ['uniq'],
  });
}


// TODO: Remove after inspecting
/*
const m = new Mock();
console.log(Mock.db.queries.save(m));
console.log(Mock.db.queries.update(m,['id']));
console.log(Mock.db.queries.fetch('id', 'avc'));
console.log(Mock.db.queries.delete('id', 'swaga'));
console.log(Perseest.test.placeholders(4));
console.log(Perseest.test.placeholders(1));
console.log(Perseest.test.placeholders(0));

process.exit(0);
*/


before(async () => {
  Mock.db.setup(process.env['PG_TEST_URI']);
  await Mock.db.pool.query('DELETE FROM Mockies');
});

after(async () => await Mock.db.cleanup());


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
  beforeEach(() => Local = class extends Mock {});
  function resetHooks() {
    Local.db.hooks = { before: {}, after: {} };
  }


  it('should initially be empty if none is specified', () => {
    for (moment of ['before', 'after']) {
      expect(Local.db.hooks).to.have.property(moment);
      expect(Object.getOwnPropertyNames(Local.db.hooks[moment]))
        .to.have.length(0);
    }
  });

  describe('should be added successfully', function() {
    specify('for a single hook', () => {
      resetHooks();
      Local.db.addHook('before', 'something', () => {});
      expect(Local.db.hooks.before.something).to.be.an('array');
      expect(Local.db.hooks.before.something).to.have.length(1);
    });

    specify('for multiple hooks', () => {
      resetHooks();
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
});


function *range(start, stop) {
  for (let i=start; i <= stop; ++i)
    yield i;
}
