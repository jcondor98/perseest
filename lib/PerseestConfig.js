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
}

module.exports = PerseestConfig
