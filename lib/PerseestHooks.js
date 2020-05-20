// Copyright 2020 Paolo Lucchesi
// All rights reserved
// This software is licensed under the MIT license found in the file LICENSE
// in the root directory of this repository
/** Perseest query hooks
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
const validate = require('validate.js')

class PerseestHooks {
  constructor () {
    this.before = []
    this.after = []
  }

  /** Add a hook - Order is guaranteed across different calls
   * @param {string} when - 'before' or 'after' hook
   * @param {string} trigger - Hook trigger
   * @param {function} hook - The hook function itself
   * @throws 'when' must be falsy or a string within 'before' and 'after'
   * @throws Hook must be a function
   * @returns undefined
   */
  add (when, hook) { // If no trigger is given, first argument is the hook
    if (!hook) {
      hook = when
      when = null
    }

    if (when && !['before', 'after'].includes(when)) {
      throw new TypeError(
        '\'when\' must be falsy or a string within [\'before\',\'after\']')
    }
    if (!validate.isFunction(hook)) { throw new TypeError('Hook must be a function') }

    for (const t of when ? [when] : ['before', 'after']) { this[t].push(hook) }
  }

  /** Run a queue of hooks in order
   * @param {string} when - Temporal hook within ['before','after']
   * @param {QueryParameters} params - parameters to pass to the hooks
   * @return undefined
   */
  async run (when, params) {
    if (!params && typeof when === 'object') {
      params = when
      when = null
    }

    if (when && !['before', 'after'].includes(when)) {
      throw new TypeError(
        'Temporal trigger must be within [\'before\',\'after\']')
    }

    try {
      for (const t of when ? [when] : ['before', 'after']) {
        for (const h of this[t]) {
          const _ = h(params)
          if (validate.isPromise(_)) { await _ }
        }
      }
    } catch (err) { throw err }
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
  flush (when = null) {
    if (when && (!validate.isString(when) ||
      !['before', 'after'].includes(when))) { throw new TypeError('\'when\' can only be \'before\' or \'after\'') }
    for (const t of when ? [when] : ['before', 'after']) { this[t] = [] }
  }
}

module.exports = PerseestHooks
