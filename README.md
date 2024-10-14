# perseest

**WARNING**: As I stated in the previous commits, this project is under heavy
development and should not be used in production. Even if I plan to create a
stable codebase , for now the API is changing often. If you like perseest, you
should stick to a version and update very carefully.

## Introduction

The _perseest_ package provides an ES6 mixin (and a base class equivalent) to
make (almost) any class and data structure storable in a database, in a fast
and painless way. The concept is to add a (thin) layer between a class and the
postgres database handler. This allows the developer to handle persistent
entities such that:

* The approach is _declarative_ instead of being _imperative_
* The actual definition of a class or type is _completely separated_ from the
way inwhich its instances are made persistent
* If an application module does not need to fetch/store/delete instances in the
database, it can use the exact same class definition without knowing anything
about these operations

The direct database handling is delegated to the
[node-postgres](https://node-postgres.com) package.


## Installation

A packaged version of perseest is available on npm
[at this link](https://www.npmjs.com/package/perseest). To install it, run:

```
npm install perseest
```

## Testing
Testing requires:

* [mocha](https://mochajs.org/)
* [expect.js](https://github.com/Automattic/expect.js)
* [nyc](https://istanbul.js.org/) if you want to verify the coverage
* A postgres database

Given these requirements, all you have to do is to pass a connection URI with
the shell environment variable `POSTGRES_URI`; then run `npm test`. To verify
the test coverage, run `npm run coverage`.

## Usage

### Making a class persistent
Basically, to make an ES6 class persistent you have to make it extend
`Perseest`, using either `Perseest.Class` or `Perseest.Mixin`, with a static
member named `db` being by an instance of `Perseest.Config`. For example,
consider a user class which has to save its username, email and hashed
password:

```js
const Perseest = require('perseest');

// Using Perseest.Class
class User extends Perseest.Class {
  constructor(name, email, hash) {
    super(); // Perseest constructors do not need any argument
    this.name = name;
    this.email = email;
    this.hash = hash;
  }

  ...

  // Use as Perseest.Config(table_name, primary_key, columns)
  // Columns are specified as an enumerable object in the form:
  //   { column_name: { attribute1: <some-value>, ... }, ... }
  static db = new Perseest.Config('UserAccount', 'id', {
    id:    { serial: true },
    name:  { id: true },
    email: { id: true },
    hash:  null  // {} is the same
  });

  // Moreover, columns can be specified as a [name,attributes] array, and when
  // there are no options to specify, you can just use a string.
  // This can be handy with a lot of columns without attributes
  static db = new PerseestConfig('UserAccount', 'id', [
    'a', 'lot', 'of', 'user', 'fields', 'but', 'just', 'one', 'with',
    ['attributes', { id: true }]
  ]);
}


// Using Perseest.Mixin
class VolatileUser {
  constructor(name, email, hash) {
    this.name = name;
    this.email = email;
    this.hash = hash;
  }
  ...
}

class User extends Perseest.Mixin(VolatileUser) {
  static db = new Perseest.Config('UserAccount', 'id', {
    id:    { serial: true },
    name:  { id: true },
    email: { id: true },
    hash:  null
  });
}
```

Column attributes define special behaviours for particular columns:

* `id` specifies that the column can be used as a univocal id
* `serial` specifies that the column is automatically handled by the database
and should not be mentioned in _INSERT_ or _UPDATE_ queries (you can still
modify it if you explicitly pass its name to `update()`)

### Default perseest interface
You can use basic, ActiveRecord inspired, methods to interface with the
database in a handy way. Assumed that we have a user persistent class, here are
some examples:

```js
const user = new User(/* ... */);

// Set up the database
User.db.setup('postgres://user:pass@www.some.db/table');

// Save the user (falls back to update() if user exists)
user.save();

// Update user columns
user.update();                 // All the columns...
user.update('email', 'hash');  // ...or just a few

// Fetch a user
const fetched = User.fetch('email', 'some@ema.il');
if (fetched === null)
  console.log('User not found');
else
  user.doALotOfBeautifulThings();

// Delete a user
user.delete();                 // By instance...
User.delete('name', 'homer');  // ...or by id

// Fetch many users
const many = User.fetchMany({ role: 'admin' }); // Require role equals 'admin'
const all = User.fetchMany(); // Fetch all the users

// Delete many users
User.deleteMany({ dangerous: true }); // Require dangerous equals true
```

These methods are present by default, and no additional configuration is
required.

**NOTE**: At this development stage, queries acting on multiple instances are
very limited. I shall implement a more sophisticated interface later on

### Queries

A perseest query is represented by a `Perseest.Query` instance, which is
composed of the following fields:

Field | Type | Description
:-:|:-:|---
`name` | `string` | Query name
`generate` | `Function` | Generate a parameterised query for node-postgres
`transform` | `Function` | Transform the query response in a return value

The actual SQL queries are dynamically generated by functions. If you need
basic INSERT/SELECT/UPDATE/DELETE, perseest is shipped with a set of query
generators which can handle arbitrary table names and columns.
If you need to perform particular operations, you can either define a new query
or use use the exposed `PerseestClass.db.pool` (which is an instance of
`pg.Pool`, see [node-postgres](https://node-postgres.com)) for a direct
interface the to the database.

**IMPORTANT SECURITY NOTE**: When you use SQL this way, you basically deal with
table and column names and values: with the default query generators, perseest
performs parameterised queries, but it _does not escapes table and column names_.
Even if no table or column name not found in the Perseest.Config object will
(hopefully) be used, checking the sanity of them is completely _up to you_.

#### Query types

Many queries share a similar behaviour. For example, the default `delete`,
`save` and `update` queries perform completely different tasks; in fact, all of
them returns `true` if some operation was performed, `false` otherwise.
The return value can be a generalizable aspect of queries: _query types_ define
common ways inwhich a node-postgres response can be transformed in a JavaScript
object (or value) to return.

Basically, a query type is identified by a name and a transform function, which
takes a `Perseest.Parameters` instance as argument.
The following types are implemented by default:

**Type** | **Description**
:-:|---
singular | Transforms a pg response in a single entity instance
multiple | Transforms a pg response in an array containing multiple entities
boolean | Returns `true` if some operation was performed, `false` otherwise
counter | Returns the number of rows involved in the query

User-defined types can be implemented. Let's realize a type
which makes a query return the of the columns having the same value for a
collection of fetched entities (along with them):

```js
// First, we define our transform function
function transformer({ conf, res }) {
  let retObj = {
    entities: res.rows.map(e => conf.row2Entity(e)),
    repetitive: []
  };
  if (res.rows.length === 0) return retObj;

  for (const f of res.fields) {
    const example = res.rows[0][f.name];
    for (const x of res.rows)
      if (x[f.name] !== example) break;
    retObj.push(f.name);
  }

  return retObj;
}

// Let's add a query type
SomePerseestentClass.db.types.set('repetitiveSpotter', transformer);

// Now we can create queries using that type (after I will explain how queries
// can be defined)
SomePerseestentClass.db.queries.create({
  name: 'someQuery',
  type: 'repetitiveSpotter',
  generate: params => { ... }
});
```

#### Adding queries

Since version 1.4, new queries can be defined with the new query interface.
Basically, you need to give:

* a name
* a query generator, i.e. a function generating an object in the form
`{ text: 'sql-query-text', values: [parameterized, query, values] }`
* either a transformer (i.e. a function taking a QueryParameters instance and
returning the candidate return value for the query performer) or the name of
an existing query type

Below some examples are given:

```js
// Let's consider a DB table containing some log messages
class LogMessage extends Perseest.Class {
  static db = new Perseest.Config('Messages', 'id', ['content', 'severity'])
}

// e.g.: We want to know if there is any error present in the table
//  (useless, trivial and stupid example, but will do)
try {
  LogMessage.db.queries.create({
    name: 'anyError',
    type: 'boolean',
    generator: ({ conf }) => ({
      text: `SELECT * FROM ${conf.table} WHERE severity = "error" LIMIT 1`,
      values: []
    })
  })
} catch (err) {
  throw err
}

// We can now call the defined query
LogMessage.db.queries.run('anyError', { conf: LogMessage.db })
  .then(presence => console.log('Got ' + presence ? '' : 'no ' + 'errors')
  .catch(console.error)

// The above call can easily become a mess with a slightly more complicated
// query. It can be handy to wrap our query calls in instance methods
LogMessage.anyError = async function anyError() {
  try {
    return await LogMessage.db.queries.run('anyError', { conf: LogMessage.db })
  } catch (err) {
    throw err;
  }
}

LogMessage.anyError()
  .then(presence => console.log('Got ' + presence ? '' : 'no ' + 'errors')
  .catch(console.error)
```

Of course, we can define hooks also for user-defined queries.

## Internal behaviour

### Parameters

Naturally, a query needs a _context_ (i.e. some application parameters) to be
executed in a program's life. This is achieved by passing a `Perseest.Parameters`
object when it is performed, composed of the following fields:

Field | Description
:-:|---
`conf` | `Perseest.Config` instance for the persistent class
`ent` | Entity instance (single)
`entities` | Entity instances (multiple)
`key` | Name of the column used as univocal id
`kval` | Value for `key`
`columns` | Names of the involved columns
`values` | Values corresponding to `columns`, in the same order

Such instance lives for the whole execution of the query, being passed also to
hooks. Moreover, other fields can be added, and such fields will be remembered
of course, allowing a middleware-like approach. For example, after having run
a query the following fields are added:

Field | Description
:-:|---
`res` | Raw node-postgres response
`ret` | Value to be returned by the query

#### Instantiating parameters

In general, you have no reason to create such objects manually, as it is
automatically done by the query performer routine. However, to offer a deeper
understanding, some examples are given below:

```js
// Construct from an entity
const params = new Perseest.Parameters({
  conf: Entity.db ent: someEntity });
console.log(params.ent);  // someEntity
console.log(params.key);  // Name of the primary key column
console.log(params.kval); // Value for the primary key
console.log(params.columns); // All the column names
console.log(params.values);  // All the column values

const params2 = new Perseest.Parameters({
  conf: Entity.db, key: 'id', kval: 123 });
console.log(params.key);  // 'id'
console.log(params.kval); // 123
console.log(params.ent);  // CAVEAT: this is undefined!
```

Every built-in field specified falsy is deduced, except for `conf` and `ent`;
leaving such fields blank will not raise an error, however it could lead to
throwing exceptions or undefined behaviour when a hook tries to reference them.

### Query hooks

You may want to do some operations (e.g. to check if an entity is valid) before
or after performing queries: this can be done by passing to the Perseest.Config
instance some functions, which we call _hooks_, with the `addHook` method.

A hook can be bound to any specific operation (e.g. save), specifying if it is
to be executed _before_ or _after_, and the adding order is preserved. A hook
can also abort a query execution by throwing an error.

Moreover, hooks can return promises or be _async_ functions: this can be very
useful if you need to populate fields of your entities with records stored in
other tables or databases, as well as to perform other asynchronous task, such
as hashing passwords if they have been changed, logging operations without
inserting boilerplate code etc.

Let's take again our user example:

```js
class User extends Perseest.Class { ... }

// Hook which validates a user before saving it to the database
// Hook parameters are passed in an object (which we are deconstructing)
function validateBeforeSave({ ent }) {
  if (!ent.isValid)
    throw new Error('User is not valid - Cannot save');
}

// Add the hook
User.db.addHook('before', 'save', validateBeforeSave);

// The code below will catch and print an error
try {
  const user = new User('b@d N0me', 'bademail', 'notavalidpasswordhash');
  user.save();
} catch (err) {
  console.error('ERRORE!!!!!!', err);
}
```

### The query performer routine

When a query is performed (e.g. you call `user.delete()`), the following
things happen:

1. Before-hooks are executed in order
2. A parameterized query is generated by the `generate` query method
3. The database is called with `pg.Pool.query`
4. The candidate return value is obtained passing the result to the `transform`
method, or to the default `row2Entity` if not present
4. After-hooks are executed in order
6. The candidate value (maybe modified by some after-hook) is returned

For a default query, if some column names are given, a check is done to make
sure that they are within the ones given in the `Perseest.Config` object.



## License

MIT License

Copyright (c) 2020 Paolo Lucchesi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
