// Copyright 2020 Paolo Lucchesi
// All rights reserved
// This software is licensed under the MIT license found in the file LICENSE
// in the root directory of this repository
/** Flexible interface for persistent entities using ES6 classes and mixins
 * and Brian Carlson's node-postgres
 *
 * @module perseest
 * @requires pg
 * @requires validate.js
 * @author jcondor */
'use strict';
const validate = require('validate.js');
const { Pool } = require('pg');


function Mixin(Base) {
  if (!Base) Base = class {};

  return class extends Base {
    constructor(...args) {
      super(args);
      if (!this.exists) this.exists = false;
    }

    /** Save the entity in the database
     * @throws Database must be available and consistent
     * @throws Entity unique fields must not be already present
     * @returns {boolean} true if the user was save
     */
    async save() {
      if (this.exists) {
        try { return await this.update(); }
        catch (err) { throw err; }
      }

      try {
        await this.constructor.runHooks('before', 'save', this);

        const response = await this.constructor.db.pool.query(
          this.constructor.db.queries.save(this));
        this.exists = true;

        await this.constructor.runHooks('after', 'save', response, this);
      } catch (err) {
        err = this.constructor.db.pgError2Error(err);
        throw err;
      }
    }


    /** Update user fields selectively
     * @param {array} args - Fields to update
     * @throws Database must be available
     * @throws Specified fields must be valid persistent properties
     * @example something.update();  // Update all the user fields
     * @example user.update(['email','name']);  // Update just email and name
     * @returns undefined
     */
    // TODO: Take variable arguments with ...
    async update(args) {
      // Handle different types for the given arguments
      if (!args) args = this.constructor.db.persistent;
      else if (validate.isString(args))
        args = [args];
      else if (!validate.isArray(args))
        throw new Error('Passed fields must be an Array or a single String');
      const fields = args;

      // If specific fields are given, validate them
      if (args) for (const f of fields)
        if (! f in this.constructor.db.persistent)
          throw new Error(`${f} is not present in the database table`);

      // Query the database
      try {
        await this.constructor.runHooks('before', 'update', this, fields);

        const response = await this.constructor.db.pool.query(
          this.constructor.db.queries.update(this, fields));

        await this.constructor.runHooks('after', 'update', response, this);
      }
      catch (err) { throw err; }
    }


    /** Fetch an entity from the database using an arbitrary identifier
     * @param {string} name - Username
     * @throws Database must be available and consistent
     * @throws Username must be valid
     * @returns {User|null} The fetched user, or null if it does not exist
     */
    static async fetch(field, value) {
      if (!this.db.identifiers.includes(field))
        throw new Error(`Field ${field} is not valid`);

      try {
        await this.runHooks('before', 'fetch', field, value);

        let ent;
        const response = await this.db.pool.query(
          this.db.queries.fetch(field, value));

        switch (response.rowCount) {
          case 0:
            ent = null;
            break;
          case 1:
            ent = this.db.row2Entity(response.rows[0]);
            break;
          default: throw new Error('Too many results were returned');
        }

        // TODO: Pass also original field/value?
        await this.runHooks('after', 'fetch', field, value);

        return ent;
      }
      catch (err) { throw err; }
    }


    /** Remove the entity from the database
     * @throws Database must be available
     * @returns {boolean} true if the entity was removed, false if not found
     */
    async delete() {
      // Hooks delegated to the static delete function
      return (!this.exists) ? false : await this.constructor.delete(
        this.constructor.db.primaryKey,
        this[this.constructor.db.primaryKey]);
    }


    /** Remove a user by arbitrary field
     * @param {string} field - Field use as identifier
     * @param {string} value - Identifier value
     * @throws Database must be available
     * @throws Field must be usable as an univocal identifier
     * @throws Identifier value must be valid
     * @returns {boolean} true if the user was removed, false if not found
     */
    static async delete(field, value) {
      if (!this.db.identifiers.includes(field))
        throw new Error(`${field} is not a valid identifier field`);

      try {
        await this.runHooks('before', 'delete', field, value);

        const response = await this.db.pool.query(
          this.db.queries.delete(field, value));

        await this.runHooks('after', 'delete', field, value);

        switch (response.rowCount) {
          case 0: return false;
          case 1: return true;
          default: throw new Error(
            `${response.rowCount} entities were removed, expected 0 or 1`);
        }
      }
      catch (err) { throw err; }
    }


    /** Setup for database connections
     * @param {object|string} opt - node-postgres connection object or URI
     * @returns undefined
     */
    static dbSetup(opt) {
      if (validate.isString(opt))
        opt = { connectionString: opt };
      this.db.pool = new Pool(opt);
    }


    /** Cleanup the database connection/pool, ignoring eventual on-close errors
     * @returns undefined
     */
    static async dbCleanup() {
      try { await this.db.pool.end(); }
      catch (err) { console.error(err); }
    }


    // Run an arbitrary array of hooks
    static async runHooks(when, trigger, ...args) {
      // Skip if no hooks are found
      if (!this.db.hooks || !this.db.hooks[when] ||
        !this.db.hooks[when][trigger]) return;
      const hooks = this.db.hooks[when][trigger];

      // Accept a single function instead of an array
      if (validate.isFunction(hooks))
        hooks = [hooks];
      else if (!validate.isArray(hooks)) throw new TypeError(
         'First argument must be a function or an array of functions');

      for (const h of hooks) {
        try {
          const _ = h(args)
          if (validate.isPromise(_))
            await _;
        }
        catch (err) { throw err; }
      }
    }


    /** Add a hook - Order is guaranteed across different calls
     * @param {string} when - 'before' or 'after' hook
     * @param {string} trigger - Hook trigger
     * @param {function} hook - The hook function itself
     * @throws 'when' must be within 'before' and 'after'
     * @throws Trigger must be specified as a string
     * @throws Hook must be a function
     * @example
     * addHook('after', 'insert', () => log('Entry successfully inserted'));
     * @example
     * addHook('before', 'save', user => {
     *   if (!user.isValid())
     *     throw new Error(`User ${user.name} is not valid`)
     * });
     * @returns undefined
     */
    static addHook(when, trigger, hook) {
      // Trigger can be 'before' or 'after'
      if (! ['before', 'after'].includes(when))
        throw new Error('\'when\' must be within [\'before\',\'after\']');

      // Trigger must be identified by a string
      if (!validate.isString(trigger))
        throw new TypeError('Hook trigger must be specified as a string');

      // Hook must be a function
      if (!validate.isFunction(hook))
        throw new TypeError('Hook must be a function');

      // Handle empty or single-function hooks for the trigger
      if (!this.db.hooks[when][trigger])
        this.db.hooks[when][trigger] = [];
      else if (validate.isFunction(this.db.hooks[when][trigger]))
        this.db.hooks[when][trigger] = [ this.db.hooks[when][trigger] ];

      // Actually push the hook in the trigger array
      this.db.hooks[when][trigger].push(hook);
    }


    static db = composeDBObject();
  };
}


/** Generate a database configuration object
 * @param {object} obj - The configuration object
 * @param {Array<String>} obj.persistent - Array of class properties to be
 *   considered persistent
 * @param {Array<String>} obj.identifiers - Array of class properties which can
 *   be used as univocal identifiers for an instance
 * @param {object} obj.queries - Object which maps query generators
 * @param {object} obj.hooks - Hooks that will be executed before and after
 *   the query calls
 * @returns {object} An object to be used as database configuration
 */
function composeDBObject(obj) {
  const defaultObj = {
    queries: {},
    hooks: {
      before: {},
      after:  {}
    },
    row2Entity: row => row,
    pgError2Error: res =>
      new Error(`${res.detail} (returned code ${res.code})`)
  };
  return Object.assign(defaultObj, obj);
}



module.exports = {
  Mixin: Mixin,
  Class: Mixin(),
  composeDBObject: composeDBObject
};
