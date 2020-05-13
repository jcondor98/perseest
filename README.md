# perseest
The _perseest_ package provides an ES6 mixin (and a base class equivalent) to
make (almost) any class and data structure storable in a database, in a fast
and painless way. The concept is to add a (thin) layer between a class and the
postgres database handler, such that the developer can interface the database
in a _declarative way_.

**NOTE**: This project is under heavy development and should not be used in
production

## Testing
Testing requires:

* [mocha](https://mochajs.org/)
* [expect.js](https://github.com/Automattic/expect.js)
* A postgres database

Given these requirements, all you have to do is to pass a connection URI with
the shell environment variable `PG_TEST_URI`; then run `npm test`.

It is assumed that mocha is installed _globally_.
