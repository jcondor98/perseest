// Copyright 2020 Paolo Lucchesi
// All rights reserved
// This software is licensed under the MIT license found in the file LICENSE
// in the root directory of this repository
/** Flexible interface for persistent entities using ES6 classes and mixins
 * and Brian Carlson's node-postgres
 *
 * @module perseest
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
 * class PerseestentUser extends Perseest.Mixin(VolatileUser) {
 *   static db = new PerseestConfig(table, pk, { ... });
 * }
 * @returns {Class} Extended (i.e. mixed) class to be used as the base class
 *   for a persistent subclass or record
 */
function Mixin (Base) {
  if (!Base) Base = class {}

  class PerseestClass extends Base {
    /** Base class for a database-persistent subclass or data structure */
    constructor (...args) {
      super(...args)
      if (!this.exists) this.exists = false
    }

    /** Save the entity in the database. If the entity exists already (i.e.
     * 'this.exists === true', fallback to update()
     * @throws Database must be available and consistent
     * @throws Database must return no errors
     * @returns {undefined}
     */
    async save () {
      if (this.exists) {
        try { return await this.update() } catch (err) { throw err }
      }

      try {
        if (this.exists) { return await this.update() }
        const ret = await this.constructor.db.queries.get('save').run(new Params({
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
     * @throws Database must be available
     * @throws Specified keys must be valid persistent properties
     * @example something.update();  // Update all the entity keys
     * @example
     * // Update just email and name for a user
     * user.update(['email','name']);
     * @returns undefined
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
        const params = new Params({
          conf: this.constructor.db, ent: this, columns: keys
        })
        return await this.constructor.db.queries.get('update').run(params)
      } catch (err) { throw err }
    }

    /** Fetch an entity from the database using an arbitrary identifier
     * @param {string} key - Identifier column
     * @param {*} value - Identifier value
     * @throws Database must be available and consistent
     * @returns {*|null} The fetched entity, or null if it does not exist
     */
    static async fetch (key, value) {
      if (!this.db.ids.has(key)) { throw new Error(`Field ${key} is not valid`) }

      try {
        const params = new Params({ conf: this.db, key: key, kval: value })
        return await this.db.queries.get('fetch').run(params)
      } catch (err) { throw err }
    }

    /** Remove the entity from the database
     * @throws Database must be available
     * @returns {boolean} true if the entity was removed, false if not found
     */
    async delete () {
      // Hooks delegated to the static delete function
      return (!this.exists) ? false : await this.constructor.delete(
        this.constructor.db.primaryKey,
        this[this.constructor.db.primaryKey])
    }

    /** Remove a user by arbitrary key-value pair (key must be an identifier)
     * @param {string} key - Field use as identifier
     * @param {string} value - Identifier value
     * @throws Database must be available
     * @throws Field must be usable as an univocal identifier
     * @throws Identifier value must be valid
     * @returns {boolean} true if the user was removed, false if not found
     */
    static async delete (key, value) {
      if (!this.db.ids.has(key)) { throw new Error(`${key} is not a valid identifier key`) }

      try {
        const params = new Params({ conf: this.db, key: key, kval: value })
        return await this.db.queries.get('delete').run(params)
      } catch (err) { throw err }
    }
  }

  return PerseestClass
}

module.exports = {
  PerseestMixin: Mixin,
  PerseestClass: Mixin()
}
