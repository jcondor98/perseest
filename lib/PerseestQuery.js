/** Perseest query class definition
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
const Hooks = require('./PerseestHooks')
const help = require('./helpers')

// TODO: Allow passing hooks
class PerseestQuery {
  /** Query performed by perseest
   * @param {string} name - Query name
   * @param {Function} generate - Query generator, must return an object in the
   *   form { text: '<query sql text>', values: [...] }
   * @param {Function} transform - Postgres result transformer, i.e. transform
   *   a database response in a return value. If falsy, perseest will attempt
   *   to transform the result in entities (with conf.row2Entity)
   */
  constructor ({ name = null, generate = null, transform = null, type = null } = {}) {
    if (!validate.isString(name) || !this.constructor.NAME_REGEX.test(name))
      throw new TypeError('Invalid query name')
    if (!validate.isFunction(generate))
      throw new TypeError('Query generator must be a function')
    if (transform && !validate.isFunction(transform))
      throw new TypeError('Query transformer must be a function if given')
    if (type) {
      if (transform)
        throw new Error('Type and Transformer cannot be specified together')
      if (!validate.isString(type))
        throw new TypeError('Type must be specified as a string')
      transform = this.constructor.types.get(type);
      if (!transform) throw new Error(`Type ${type} not found`);
    }
    this.name = name
    this.generate = generate
    this.transform = transform
    this.hooks = new Hooks()
  }

  /** Run the query
   * @param {QueryParameters} params - Parameters passed to the query
   * @throws Database must raise no errors
   * @throws Hooks must run successfully
   * @returns {*} Some result defined by the query transformer
   */
  async run (params) {
    params.query = this
    const transform = this.transform ||
      (({ res }) => params.conf.row2Entity(res.rows[0]))
    try {
      await this.hooks.run('before', params)
      //console.log(this.generate(params))
      params.res = await params.conf.pool.query(this.generate(params))
      params.ret = transform(params)
      await this.hooks.run('after', params)
      return params.ret
    } catch (err) {
      throw params.conf.pgError2Error(err) // TODO: Handle non-pg errors
    }
  }

  /** Map data structure for queries
   * @class
   * @param {Iterable<PerseestQuery>} queries - Iterable collection of
   *   instantiated queries
   * @throws Queries must be instances of PerseestQuery if given
   */
  static Map = class PerseestQueryMap extends Map {
    constructor(queries) {
      super()
      if (queries) for (const q of queries) this.add(q)
    }

    // TODO: Name should match q.name?
    /** Set a key/value entry, just like in standard Map
     * @param {string} name - Query name
     * @param {PerseestQuery} query - The query instance
     * @throws Query must be instance of PerseestQuery
     * @throws Name must be a string
     */
    set(name, query) {
      if (!validate.isString(name))
        throw new TypeError('Name must be a string')
      if (!PerseestQuery.NAME_REGEX.test(name))
        throw new TypeError('Name must be a string')
      if (!(query instanceof PerseestQuery))
        throw new TypeError('Query must be an instance of PerseestQuery')
      super.set(name, query)
    }

    /** Add a query
     * @param {PerseestQuery} query - The query instance
     * @throws Query must be instance of PerseestQuery
     * @returns undefined
     */
    add(query) { this.set(query.name, query) }

    /** Create and add a query
     * @param {object} opt - Options passed to the PerseestQuery constructor
     * @throws Parameters must be consistent
     * @returns undefined
     */
    create(opt) { this.add(new PerseestQuery(opt)) }

    /** Run a query
     * @param {string} query - Query name
     * @param {QueryParameters} params - Parameters to be passed to the query
     * @throws Query must be present
     * @throws Performing the query must raise no errors
     * @returns {*} The value returned by the query
     */
    async run(query, params) {
      const q = this.get(query);
      if (!q) throw new Error(`Unable to find query ${query}`)

      try { return await q.run(params) }
      catch (err) { throw err }
    }
  }


  /** Map data structure for query types. Each query type is identified by a
   * name and a transform function
   * @class
   * @param {Iterable<Array>} types - Iterable collection of query types in
   *   the form [name, transform]
   */
  static TypeMap = class PerseestQueryTypeMap extends Map {
    constructor(types) {
      super()
      if (types) for (const [k,v] of types) this.set(k,v)
    }

    /** Set a key/value entry, just like in standard Map
     * @param {string} name - Query type name
     * @param {Function} transform - The query transformer
     * @throws Transformer must be a function
     * @throws Name must be a string
     */
    set(name, transform) {
      if (!name || !validate.isString(name))
        throw new TypeError('Name must be a string')
      if (!validate.isFunction(transform))
        throw new TypeError('Transformer must be a function')
      super.set(name, transform)
    }
  }


  /** Generate a default Map of queries (with save/fetch/update/delete)
   * @returns {Map<String,PerseestQuery>} A Map containing the default
   *   perseest queries
   */
  static default() {
    const queries = new this.Map();
    queries.add(new PerseestQuery({
      name: 'save',
      type: 'boolean',
      generate: ({ conf, ent, columns }) => {
        const [cols, vals] = help.entityCV(ent, columns)
        return {
          text: `INSERT INTO ${conf.table} (${cols.join(', ')}) VALUES (${help.placeholders(cols.length)})`,
          values: vals
        }
      }
    }));
    queries.add(new PerseestQuery({
      name: 'fetch',
      type: 'singular',
      generate: ({ conf, key, kval }) => ({
        text: `SELECT * FROM ${conf.table} WHERE ${key} = $1`,
        values: [kval]
      }),
    }));
    queries.add(new PerseestQuery({
      name: 'update',
      type: 'boolean',
      generate: ({ conf, ent, columns }) => ({
        text: `UPDATE ${conf.table} SET ` +
          columns.map((c, idx) => `${c} = $${idx + 1}`).join(', ') +
          ` WHERE ${conf.primaryKey} = $${columns.length + 1};`,
        values: columns.map(k => ent[k]).concat(ent[conf.primaryKey])
      })
    }));
    queries.add(new PerseestQuery({
      name: 'delete',
      type: 'boolean',
      generate: ({ conf, key, kval }) => ({
        text: `DELETE FROM ${conf.table} WHERE ${key} = $1`,
        values: [kval]
      })
    }));
    queries.add(new PerseestQuery({ // TODO: Add things like AND, OR ...
      name: 'fetchMany',
      type: 'multiple',
      generate: ({ conf, key, kval }) => ({
        text: `SELECT * FROM ${conf.table}`.concat(key ? ` WHERE ${key} = $1` : ''),
        values: key ? [kval] : []
      }),
    }));
    queries.add(new PerseestQuery({
      name: 'deleteMany',
      type: 'counter',
      generate: ({ conf, key, kval }) => ({
        text: `DELETE FROM ${conf.table} WHERE ${key} = $1`,
        values: [kval]
      })
    }));
    return queries;
  }

  /** Query types, filled with default 'singular', 'multiple' and 'boolean' */
  static types = new this.TypeMap([
    ['singular', ({ res, conf }) => {
      if (!res.rows.length) return null;
      return conf.row2Entity(res.rows[0]);
    }],
    ['multiple', ({ res, conf }) =>
      res.rows.map(conf.row2Entity) ],
    ['boolean', ({ res }) => res.rowCount ? true : false],
    ['counter', ({ res }) => res.rowCount]
  ]);

  static NAME_REGEX = /^[a-z_][a-z0-9_]*$/i;
}


module.exports = PerseestQuery
