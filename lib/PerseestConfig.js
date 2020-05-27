/** Perseest configuration object
 * @requires pg
 * @requires validate.js
 * @author jcondor
 * @license
 * Copyright 2020 Paolo Lucchesi
 * All rights reserved
 * This software is licensed under the MIT license found in the file LICENSE
 * in the root directory of this repository
 */
'use strict'
const validate = require('validate.js')
const { Pool } = require('pg')
const Query = require('./PerseestQuery')
const help = require('./helpers')

class PerseestConfig {
  /** Persistency configuration object
   * @param {string} table - Table name for the persistent entities
   * @param {string} primaryKey - Name of the parameter used as primary key
   * @param {object} opt - Optional parameters
   * @param {Iterable<String|Array>|Object} opt.columns - Additional columns,
   *   specified as an iterable collection or as an enumerable object
   * @throws Table must be a non-blank string
   * @throws PrimaryKey must be a non-blank string
   * @throws Columns must be an iterable collection
   */
  constructor (table, primaryKey, columns) {
    if (!validate.isString(table) || table === '') { throw new TypeError('table must be a non-blank string') }
    if (!validate.isString(primaryKey) || primaryKey === '') { throw new TypeError('primaryKey must be a non-blank string') }

    this.table = table
    this.primaryKey = primaryKey

    // Fill column map, adding primary key if not present already
    this.columns = new this.constructor.ColumnMap(columns);
    const pk = this.columns.get(primaryKey) || {}
    this.columns.set(primaryKey, Object.assign(pk, { id: true }))

    // Default queries
    this.queries = Query.default()

    // TODO: Improve, Accept other than defaults
    this.row2Entity = row => row
    this.pgError2Error = res => res
    // new Error(`${res.detail} (returned code ${res.code})`)
  }

  /** Setup for database connections
   * @param {object|string} opt - node-postgres connection object or URI
   * @returns undefined
   */
  setup (opt) {
    if (validate.isString(opt)) { opt = { connectionString: opt } }
    this.pool = new Pool(opt)
  }

  /** Cleanup the database connection/pool, ignoring eventual on-close errors
   * @returns {Error|null} An Error if closing the pool fails, null otherwise
   */
  async cleanup () {
    try {
      await this.pool.end()
      return null
    } catch (err) {
      return err
    }
  }

  /** Add a hook - Order is guaranteed across different calls
   * @param {string} when - 'before' or 'after' hook
   * @param {string} trigger - Hook trigger must be a valid query name
   * @param {function} hook - The hook function itself
   * @throws 'when' must be falsy or a string within 'before' and 'after'
   * @throws Trigger must be the name of an existent query
   * @throws Hook must be a function
   * @example
   * Class.db.addHook('after', 'insert', () => log('Entry successfully inserted'));
   * @example
   * Class.db.addHook('before', 'save', user => {
   *   if (!user.isValid())
   *     throw new Error(`User ${user.name} is not valid`)
   * });
   * @returns undefined
   */
  addHook (when, trigger, hook) {
    // Trigger can be 'before' or 'after'
    if (!['before', 'after'].includes(when)) {
      throw new TypeError(
        '\'when\' must be falsy or a string within [\'before\',\'after\']')
    }

    // Trigger must be identified by a string
    if (!validate.isString(trigger)) { throw new TypeError('Hook trigger must be specified as a string') }

    // Hook must be a function
    if (!validate.isFunction(hook)) { throw new TypeError('Hook must be a function') }

    // Trigger must be the name of a present query
    const query = this.queries.get(trigger)
    if (!query) throw new Error('Trigger does not point to a present query')

    // Push the hook in the hooks array, or initialize it if empty
    query.hooks.add(when, hook)
  }

  /** Flush the hooks
   * @param {string} when - Temporal trigger
   * @param {string} trigger - Hook trigger
   * @throws 'when' must be falsy or a string within 'before' and 'after'
   * @throws Trigger must be the name of an existent query
   * @example Mocky.db.flushHooks()  // Flush all the hooks
   * @example Mocky.db.flushHooks('before')  // Flush all the before-hooks
   * @example
   * // Flush all the after-hooks triggered by doh
   * SomeClass.db.flushHooks('after', 'doh')
   * @example
   * // Flush all the before-hooks and after-hooks triggered by doh
   * SomeClass.db.flushHooks(null, 'doh')
   * @returns undefined
   */
  flushHooks (when = null, trigger = null) {
    if (when && (!validate.isString(when) ||
      !['before', 'after'].includes(when))) { throw new TypeError('\'when\' can only be \'before\' or \'after\'') }
    // Trigger must be identified by a string
    if (trigger && !validate.isString(trigger)) { throw new TypeError('Hook trigger must be specified as a string') }

    let query
    if (trigger) {
      query = this.queries.get(trigger)
      if (!query) throw new Error('Trigger does not point to a present query')
    }

    if (query) query.hooks.flush(when)
    else for (const [t, q] of this.queries) q.hooks.flush(when)
  }

  /** Map data structure for columns
   * @class
   * @param {Iterable<String|Object>} columns - Iterable collection of columns
   * @throws Queries must be instances of PerseestQuery if given
   */
  static ColumnMap = class PerseestColumnMap extends Map {
    constructor(columns) {
      super();
      if (!columns) return
      if (validate.isString(columns))
        this.set(columns);
      else if (help.isIterable(columns))
        for (const x of columns) {
          if (validate.isString(x))
            this.set(x);
          else if (validate.isArray(x))
            this.set(x[0], x[1]);
          else throw new Error('Item must be a string or a [k,v] array')
        }
      else for (const x in columns) this.set(x, columns[x])
    }

    /** Set a key/value entry, just like in standard Map
     * @param {string} name - Column name
     * @param {object} props - Column properties
     * @throws Name must be a string
     * @throws Properties must be an object
     */
    set(name, props = {}) {
      if (!name || !validate.isString(name))
        throw new TypeError('Name must be a non-blank string')
      super.set(name, props)
    }

    /** Get a single attribute of a column
     * @param {string} column - Column name
     * @param {string} attr - Attribute name
     * @returns {boolean} true if the attribut is set and truthy, false in 
     *   any other case (included inexistent or invalid parameter)
     */
    attribute(col, attr) {
      if (!col || !attr || !validate.isString(col) || !validate.isString(attr))
        return false;
      const c = this.get(col)
      return c ? (c[attr] ? true : false) : false
    }
  }
}

module.exports = PerseestConfig
