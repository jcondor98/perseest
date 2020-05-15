# perseest
The _perseest_ package provides an ES6 mixin (and a base class equivalent) to
make (almost) any class and data structure storable in a database, in a fast
and painless way. The concept is to add a (thin) layer between a class and the
postgres database handler, such that the developer can interface the database
in a _declarative way_.

The direct database handling is delegated to the
[node-postgres](https://node-postgres.com) package.

**NOTE**: This project is under heavy development and should not be used in
production

## Installation

For now, if you want to use perseest, you have to clone the git repo and
`require ('some/path/perseest')`. An NPM package will be published ASAP.

## Testing
Testing requires:

* [mocha](https://mochajs.org/)
* [expect.js](https://github.com/Automattic/expect.js)
* A postgres database

Given these requirements, all you have to do is to pass a connection URI with
the shell environment variable `PG_TEST_URI`; then run `npm test`.

It is assumed that mocha is installed _globally_.

## Usage

### Making a class persistent
Basically, to make a ES6 class persistent you have to make it extend
`Perseest`, using either `Perseest.Class` or `Perseest.Mixin`, with a static
member given by an instance of `Perseest.Config`. For example, consider a user
class which has to save its username, email and hashed password:

```
const Perseest = require('perseest');

// Using Perseest.Class
class User extends Perseest {
  constructor(name, email, hash) {
    super(); // Perseest constructors do not need any argument
    this.name = name;
    this.email = email;
    this.hash = hash;
  }

  ...

  static db = new Perseest.Config({
    primaryKey: 'name',
    ids: ['email'],
    columns: ['hash']
  });
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
  // Use as Perseest.Config(table_name, primary_key, options)
  static db = new Perseest.Config('Users', 'name', {
    ids: ['email'],
    columns: ['hash']
  });
}
```

### Using the perseest interface
You can use basic, ActiveRecord inspired, methods to interface with the
database in a handy way. Assumed that we have a user persistent class, here are
a few examples:

```
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
```

### Queries
When a query is performed (e.g. you call `user.delete()`), the following
things happen:

1. If column name are given, a check is done to make sure that they are within
the ones given in the Perseest.Config object
2. Before-hooks are executed in order
3. The database is called with `pg.Pool.query`
4. After-hooks are executed in order
5. Something is returned (it depends on the query and wrapper method)

The actual SQL queries are dynamically generated by functions. If you need
basic INSERT/SELECT/UPDATE/DELETE, perseest is shipped with a set of query
generators which can handle arbitrary table names and columns. For now, custom
generators cannot be added in a handy way, but this will be hopefully added
soon. If you need to perform particular operation, you can use the exposed
`PerseestClass.db.pool` to directly query the database: it is an instance of
`Pool`, which is implemented in [node-postgres](https://node-postgres.com).

**IMPORTANT SECURITY NOTE**: When you use SQL this way, you basically deal with
table and column names and values: with the default query generators, perseest
performs parameterised queries, but it _does not escapes table and column names_.
Even if no table or column name not found in the Perseest.Config object will
(hopefully) be used, checking the sanity of them is completely _up to you_.

### Query hooks
You may want to do some operations or checking something before or after
performing queries: this can be done by passing to the Perseest.Config instance
some functions, which we call _hooks_, with the `addHook` method.

A hook can be bound to any specific operation (e.g. save), specifying if it is
to be executed _before_ or _after_, and the adding order is preserved. A hook
can abort an operation by throwing an error.

Moreover, hooks can return promises or be _async_ functions: this can be very
useful if you need to populate fields of your entities with records stored in
other tables or databases, as well as to perform other asynchronous task, such
as hashing passwords if they have been changed, logging operations without
inserting boilerplate code etc.

Let's take again our user example:

```
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

#### Hook interface
Assume that different queries (having a different nature) need to cosider
different things (such as entity instance, involved columns names etc...), so
does the query hooks; for this reason, the parameters passed to a hook are
wrapped in an instance of `Perseest.HookParameters`. Such an instance can be
constructed considering different parameters; below a few examples are given:

```
// Construct from an entity
const params = new Perseest.HookParameters({
  conf: Entity.db ent: someEntity });
console.log(params.ent);  // someEntity
console.log(params.key);  // Name of the primary key column
console.log(params.kval); // Value for the primary key
console.log(params.columns); // All the column names
console.log(params.values);  // All the column values

const params2 = new Perseest.HookParameters({
  conf: Entity.db, key: 'id', kval: 123 });
console.log(params.key);  // 'id'
console.log(params.kval); // 123
console.log(params.ent);  // CAVEAT: this is undefined!
```

Every field specified falsy is deduced, except for `conf` and `ent`; leaving
such fields blank will not raise an error, however it could lead to throwing
errors or undefined behaviours when a hook tries to reference them.

In general, you have no reason to create such objects manually, as it is
automatically done by the query performers.

A `Perseest.HookParameters` instance, if correctly created, implements the
following fields:

Field | Description
:-:|---
`conf` | `Perseest.Config` instance for the persistent class
`ent` | Entity instance
`key` | Name of the column used as univocal id
`kval` | Value for `key`
`columns` | Names of the involved columns
`values` | Values corresponding to `columns`, in the same order

Apart from those, other fields can be added, and such fields will be remembered
across different hooks calls, allowing a middleware-like approach.



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
