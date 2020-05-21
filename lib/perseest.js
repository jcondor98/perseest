/** Flexible interface for persistent entities using ES6 classes and mixins
 * and Brian Carlson's node-postgres
 * @requires validate.js
 * @author jcondor
 * @license
 * Copyright 2020 Paolo Lucchesi
 * All rights reserved
 * This software is licensed under the MIT license found in the file LICENSE
 * in the root directory of this repository
 */
'use strict'
const Params = require('./QueryParameters')
const validate = require('validate.js')
const help = require('./helpers')

/** Generate a base class for a database-persistent subclass or data structure
 * from another class (i.e. function-style mixin)
 * @param {Class} Base - Base class to extend
 * @example
 * // Create a persistent user from a user which does not support a database
 * class VolatileUser { ... }
 * class User extends Perseest.Mixin(VolatileUser) {
 *   static db = new Perseest.Config(table, pk, { ... });
 * }
 * @returns {Class} Extended (i.e. mixed) class to be used as the base class
 *   for a persistent subclass
 */
function Mixin (Base) {
  if (!Base) Base = class {}

  class PerseestClass extends Base {
    /** Base class for a database-persistent subclass or data structure
     * @param {...*} args - Arguments for the superclass constructor
     */
    constructor (...args) {
      super(...args)
      if (!this.exists) this.exists = false
    }

    /** Save the entity in the database. If the entity exists already (i.e.
     * 'this.exists' is truthy, fallback to update()
     * @throws Database must raise no errors
     * @throws Hooks must run successfully
     * @returns {boolean} true if the user was saved, false otherwise
     */
    async save () {
      try {
        if (this.exists) { return await this.update() }
        const ret = await this.constructor.db.queries.run('save', new Params({
          conf: this.constructor.db,
          ent: this
        }))
        if (ret) this.exists = true
        return ret
      } catch (err) {
        throw err
      }
    }

    /** Update entity columns selectively
     * @param {array} args - Fields to update
     * @throws Specified keys must be valid persistent properties
     * @throws Database must raise no errors
     * @throws Hooks must run successfully
     * @example something.update();  // Update all the entity keys
     * @example
     * // Update just email and name for a user
     * user.update('email', 'name')
     * user.update(['email','name'])  // Works equally
     * user.update(new Set(['email','name']))  // Any iterable collection works
     * @returns {boolean} true if the user was updated, false otherwise
     */
    async update (...args) {
      // Handle different types for the given arguments
      if (args.length === 0) { args = [...this.constructor.db.columns] } else if (!validate.isString(args[0]) && help.isIterable(args[0])) { args = args[0] }
      const keys = validate.isArray(args) ? args : [...args]

      // If specific keys are given, validate them
      for (const k of keys) {
        if (!validate.isString(k)) { throw new TypeError('Columns must be specified as strings') }
        if (!this.constructor.db.columns.has(k)) { throw new Error(`${k} is not present in the database table`) }
      }

      // Query the database
      try {
        return await this.constructor.db.queries.run('update', new Params({
          conf: this.constructor.db, ent: this, columns: keys
        }))
      } catch (err) { throw err }
    }

    /** Fetch an entity from the database using an arbitrary identifier
     * @param {string} key - Identifier column
     * @param {*} value - Identifier value
     * @throus Key must be a column usable as a univocal identifier
     * @throws Database must raise no errors
     * @throws Hooks must run successfully
     * @returns {*|null} The fetched entity, or null if it does not exist
     */
    static async fetch (key, value) {
      if (!this.db.ids.has(key)) { throw new Error(`Field ${key} is not a univocal identifier`) }

      try {
        return await this.db.queries.run('fetch', new Params({
          conf: this.db, key: key, kval: value
        }))
      } catch (err) { throw err }
    }

    /** Remove the entity from the database
     * @throws Database must raise no errors
     * @throws Hooks must run successfully
     * @returns {boolean} true if the entity was removed, false if not found
     */
    async delete () {
      // Hooks delegated to the static delete function
      return (!this.exists) ? false : await this.constructor.delete(
        this.constructor.db.primaryKey,
        this[this.constructor.db.primaryKey])
    }

    /** Remove a user by arbitrary key-value pair (key must be an identifier)
     * @param {string} key - Field used as univocal identifier
     * @param {string} value - Identifier value
     * @throws Key must be a column usable as univocal identifier
     * @throws Identifier value must be valid
     * @throws Database must raise no errors
     * @throws Hooks must run successfully
     * @returns {boolean} true if the user was removed, false if not found
     */
    static async delete (key, value) {
      if (!this.db.ids.has(key)) { throw new Error(`${key} is not a valid identifier key`) }

      try {
        return await this.db.queries.run('delete', new Params({
          conf: this.db, key: key, kval: value
        }))
      } catch (err) { throw err }
    }
  }

  return PerseestClass
}

module.exports = {
  PerseestMixin: Mixin,
  PerseestClass: Mixin()
}
