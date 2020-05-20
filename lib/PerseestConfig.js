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
   * @param {Iterable<String>} opt.ids - Additional columns which can be used
   *   as univocal identifiers for an instance
   * @param {Iterable<String>} opt.columns - Additional columns
   * @throws Table must be a non-blank string
   * @throws PrimaryKey must be a non-blank string
   * @throws Ids must be an iterable collection
   * @throws Columns must be an iterable collection
   */
  constructor (table, primaryKey, { ids = [], columns = [] } = {}) {
    if (!validate.isString(table) || table === '') { throw new TypeError('table must be a non-blank string') }
    if (!validate.isString(primaryKey) || primaryKey === '') { throw new TypeError('primaryKey must be a non-blank string') }
    if (!help.isIterable(ids)) { throw new TypeError('ids must be an iterable collection') }
    if (!help.isIterable(columns)) { throw new TypeError('columns must be an iterable collection') }

    this.table = table
    this.primaryKey = primaryKey
    this.ids = new Set(ids.concat(primaryKey))
    this.columns = this.ids.union(columns)

    // Default queries
    this.queries = Query.default()

    // TODO: Improve, Accept other than defaults
    this.row2Entity = row => row,
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
}

module.exports = PerseestConfig
