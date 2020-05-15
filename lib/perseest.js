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
const help = require('./helpers');


class PerseestConfig {
  // TODO: Validity checks should be more strict
  /** Persistency configuration object
   * @param {string} table - Table name for the persistent entities
   * @param {string} primaryKey - Name of the parameter used as primary key
   * @param {object} opt - Optional parameters
   * @param {Iterable<String>} opt.ids - Additional columns which can be used
   *   as univocal identifiers for an instance
   * @param {Iterable<String>} opt.columns - Additional columns
   * @throws Table must be a non-blank string
   * @throws PrimaryKey must be a non-blank string
   * @throws Ids must be an iterable collection
   * @throws Columns must be an iterable collection
   */
  constructor(table, primaryKey, { ids=[], columns=[] }) {
    if (!validate.isString(table) || table === '')
      throw new TypeError('table must be a non-blank string');
    if (!validate.isString(primaryKey) || primaryKey === '')
      throw new TypeError('primaryKey must be a non-blank string');
    if (!help.isIterable(ids))
      throw new TypeError('ids must be an iterable collection');
    if (!help.isIterable(columns))
      throw new TypeError('columns must be an iterable collection');

    this.table = table;
    this.primaryKey = primaryKey;
    this.ids = new Set(ids.concat(primaryKey));
    this.columns = this.ids.union(columns);
    this.hooks = { before: {}, after: {} };

    // Default queries - TODO: Allow modifications
    this.queries = {
      save: ent => {
        const [cols, vals] = help.entityCV(ent, this.columns);
        return {
          text: `INSERT INTO ${this.table} (${cols.join(', ')}) VALUES (${help.placeholders(cols.length)})`,
          values: vals
        };
      },
      fetch: (key,val) => ({
        text: `SELECT * FROM ${this.table} WHERE ${key} = $1`,
        values: [val]
      }),
      update: (ent,keys) => ({
        text: `UPDATE ${this.table} SET ` +
          keys.map((k,idx) => `${k} = $${idx+1}`).join(`, `) +
          ` WHERE ${this.primaryKey} = $${keys.length + 1};`,
        values: keys.map(k => ent[k]).concat(ent[this.primaryKey])
      }),
      delete: (key,val) => ({
        text: `DELETE FROM ${this.table} WHERE ${key} = $1`,
        values: [val]
      })
    },


    // TODO: Accept other than defaults
    this.row2Entity = row => row,
    this.pgError2Error = res => res;
      //new Error(`${res.detail} (returned code ${res.code})`)
  }

  /** Setup for database connections
   * @param {object|string} opt - node-postgres connection object or URI
   * @returns undefined
   */
  setup(opt) {
    if (validate.isString(opt))
      opt = { connectionString: opt };
    this.pool = new Pool(opt);
  }

  /** Cleanup the database connection/pool, ignoring eventual on-close errors
   * @returns undefined
   */
  async cleanup() {
    try { await this.pool.end(); }
    catch (err) { console.error(err); }
  }


  /** Add a hook - Order is guaranteed across different calls
   * @param {string} when - 'before' or 'after' hook
   * @param {string} trigger - Hook trigger
   * @param {function} hook - The hook function itself
   * @throws 'when' must be falsy or a string within 'before' and 'after'
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
  addHook(when, trigger, hook) {
    // Trigger can be 'before' or 'after'
    if (! ['before', 'after'].includes(when))
      throw new TypeError(
        '\'when\' must be falsy or a string within [\'before\',\'after\']');

    // Trigger must be identified by a string
    if (!validate.isString(trigger))
      throw new TypeError('Hook trigger must be specified as a string');

    // Hook must be a function
    if (!validate.isFunction(hook))
      throw new TypeError('Hook must be a function');

    // Push the hook in the hooks array, or initialize it if empty
    if (!this.hooks[when][trigger])
      this.hooks[when][trigger] = [hook];
    else this.hooks[when][trigger].push(hook);
  }


  // Run an arbitrary array of hooks
  // Should be only used by Perseest internally
  // TODO: Document?
  async runHooks(when, trigger, ...args) {
    const hooks = this.hooks[when][trigger];
    if (!hooks) return;

    for (const h of hooks) {
      try {
        const _ = h(...args)
        if (validate.isPromise(_))
          await _;
      }
      catch (err) { throw err; }
    }
  }


  /** Flush the hooks
   * @param {string} when - Temporal trigger
   * @param {string} trigger - Hook trigger
   * @example ent.db.flushHooks()  // Flush all the hooks
   * @example ent.db.flushHooks('before')  // Flush all the before-hooks
   * @example
   * // Flush all the after-hooks triggered by doh
   * ent.db.flushHooks('after', 'doh')
   * @example
   * // Flush all the before-hooks and after-hooks triggered by doh
   * ent.db.flushHooks(null, 'doh')
   * @returns undefined
   */
  flushHooks(when=null, trigger=null) {
    if (when && (!validate.isString(when) || ! when in ['before', 'after']))
      throw new TypeError('\'when\' can only be \'before\' or \'after\'');
    if (trigger === '' || (trigger && !validate.isString(trigger)))
      throw new TypeError('Trigger must be a non-blank string');

    const times = when ? [when] : ['before', 'after'];
    for (const t of times) {
      if (trigger) delete this.hooks[t][trigger];
      else this.hooks[t] = {};
    }
  }
}



/** Generate a base class for a database-persistent subclass or data structure
 * from another class (i.e. function-style mixin
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
function Mixin(Base) {
  if (!Base) Base = class {};

  class PerseestClass extends Base {
    /** Base class for a database-persistent subclass or data structure */
    constructor(...args) {
      super(...args);
      if (!this.exists) this.exists = false;
    }


    /** Save the entity in the database. If the entity exists already (i.e.
     * 'this.exists === true', fallback to update()
     * @throws Database must be available and consistent
     * @throws Database must return no errors
     * @returns {undefined}
     */
    async save() {
      if (this.exists) {
        try { return await this.update(); }
        catch (err) { throw err; }
      }

      try {
        await this.constructor.db.runHooks('before', 'save', this);

        const response = await this.constructor.db.pool.query(
          this.constructor.db.queries.save(this));
        this.exists = true;

        await this.constructor.db.runHooks('after', 'save', response, this);
      } catch (err) {
        err = this.constructor.db.pgError2Error(err);
        throw err;
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
    async update(...args) {
      // Handle different types for the given arguments
      if (args.length === 0)
        args = [...this.constructor.db.columns];
      else if (!validate.isString(args[0]) && help.isIterable(args[0]))
        args = args[0];
      const keys = validate.isArray(args) ? args : [...args];

      // If specific keys are given, validate them
      for (const k of keys) {
        if (!validate.isString(k))
          throw new TypeError('Columns must be specified as strings');
        if (! k in this.constructor.db.columns)
          throw new Error(`${k} is not present in the database table`);
      }

      // Query the database
      try {
        await this.constructor.db.runHooks('before', 'update', this, keys);

        const response = await this.constructor.db.pool.query(
          this.constructor.db.queries.update(this, keys));

        await this.constructor.db.runHooks('after', 'update', response, this);
      }
      catch (err) { throw err; }
    }


    /** Fetch an entity from the database using an arbitrary identifier
     * @param {string} key - Identifier column
     * @param {*} value - Identifier value
     * @throws Database must be available and consistent
     * @returns {*|null} The fetched entity, or null if it does not exist
     */
    static async fetch(key, value) {
      if (!this.db.ids.has(key))
        throw new Error(`Field ${key} is not valid`);

      try {
        await this.db.runHooks('before', 'fetch', key, value);

        let ent;
        const response = await this.db.pool.query(
          this.db.queries.fetch(key, value));

        switch (response.rowCount) {
          case 0:
            ent = null;
            break;
          case 1:
            ent = this.db.row2Entity(response.rows[0]);
            break;
          default: throw new Error('Too many results were returned');
        }

        // TODO: Pass also original key/value?
        await this.db.runHooks('after', 'fetch', response, ent);

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


    /** Remove a user by arbitrary key-value pair (key must be an identifier)
     * @param {string} key - Field use as identifier
     * @param {string} value - Identifier value
     * @throws Database must be available
     * @throws Field must be usable as an univocal identifier
     * @throws Identifier value must be valid
     * @returns {boolean} true if the user was removed, false if not found
     */
    static async delete(key, value) {
      if (! key in this.db.ids)
        throw new Error(`${key} is not a valid identifier key`);

      try {
        await this.db.runHooks('before', 'delete', key, value);

        const response = await this.db.pool.query(
          this.db.queries.delete(key, value));

        await this.db.runHooks('after', 'delete', response, key, value);

        switch (response.rowCount) {
          case 0: return false;
          case 1: return true;
          default: throw new Error(
            `${response.rowCount} entities were removed, expected 0 or 1`);
        }
      }
      catch (err) { throw err; }
    }
  }

  return PerseestClass;
}


module.exports = {
  Mixin: Mixin,
  Class: Mixin(),
  Config: PerseestConfig
};
