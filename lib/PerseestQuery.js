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

// Map data structure with type checking for query types
class QueryTypeMap extends Map {
  constructor(...args) { super(...args) }

  set(key, value) {
    if (!validate.isString(key))
      throw new TypeError('Key must be a string')
    if (!validate.isFunction(value))
      throw new TypeError('Value must be a function')
    super.set(key, value)
  }
}

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
    if (!validate.isString(name) || !/^[a-z_][a-z0-9_]*$/i.test(name))
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
      params.res = await params.conf.pool.query(this.generate(params))
      params.ret = transform(params)
      await this.hooks.run('after', params)
      return params.ret
    } catch (err) {
      throw params.conf.pgError2Error(err) // TODO: Handle non-pg errors
    }
  }

  /** Generate a default Map of queries (with save/fetch/update/delete)
   * @returns {Map<String,PerseestQuery>} A Map containing the default
   *   perseest queries
   */
  static default () { // TODO: Improve performances
    return new Map([
      new PerseestQuery({
        name: 'save',
        type: 'boolean',
        generate: ({ conf, ent, columns }) => {
          const [cols, vals] = help.entityCV(ent, columns)
          return {
            text: `INSERT INTO ${conf.table} (${cols.join(', ')}) VALUES (${help.placeholders(cols.length)})`,
            values: vals
          }
        }
      }),
      new PerseestQuery({
        name: 'fetch',
        type: 'singular',
        generate: ({ conf, key, kval }) => ({
          text: `SELECT * FROM ${conf.table} WHERE ${key} = $1`,
          values: [kval]
        }),
      }),
      new PerseestQuery({
        name: 'update',
        type: 'boolean',
        generate: ({ conf, ent, columns }) => ({
          text: `UPDATE ${conf.table} SET ` +
            columns.map((c, idx) => `${c} = $${idx + 1}`).join(', ') +
            ` WHERE ${conf.primaryKey} = $${columns.length + 1};`,
          values: columns.map(k => ent[k]).concat(ent[conf.primaryKey])
        })
      }),
      new PerseestQuery({
        name: 'delete',
        type: 'boolean',
        generate: ({ conf, key, kval }) => ({
          text: `DELETE FROM ${conf.table} WHERE ${key} = $1`,
          values: [kval]
        })
      }),
    ].map(e => [e.name, e]))
  }

  static types = new QueryTypeMap([
    ['singular', ({ res, conf }) => {
      if (!res.rows.length) return null;
      return conf.row2Entity(res.rows[0]);
    }],
    ['multiple', ({ query, res, conf }) =>
      res.rows.length ? res.rows.map(query.transform || conf.row2Entity) : [] ],
    ['boolean', ({ res }) => res.rowCount ? true : false]
  ]);
}


module.exports = PerseestQuery
