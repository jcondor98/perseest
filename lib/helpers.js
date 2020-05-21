/** Perseest helpers module
 * @module helpers
 * @author jcondor
 * @license
 * Copyright 2020 Paolo Lucchesi
 * All rights reserved
 * This software is licensed under the MIT license found in the file LICENSE
 * in the root directory of this repository
 */
'use strict'

/** Generate values from 'start' to 'stop' (both inclusive)
 * If start > stop, the range is generated in descending order
 * @example range(1,5)   // 1, 2, 3, 4, 5
 * @example range(1,-3)  // 1, 0, -1, -2, -3
 * @example range(1,1)   // 1
 * @param {number} start
 * @param {number} stop
 * @returns {Generator} The previous value incremented by 1 at each iteration
 */
function * range (start, stop) {
  // TODO: Check type
  const inc = start < stop ? x => ++x : x => --x
  const cmp = start < stop ? (x, y) => x <= y : (x, y) => x >= y
  for (let i = start; cmp(i, stop); i = inc(i)) { yield i }
}

/** Return a string of 'n' placeholders for a parameterized query
 * @param {number} n - Number of values for which placeholders must be generated
 * @returns {string} A string in the form '$1, $2, $3, ... , $n'
 * @example placeholders(3)  // '$1, $2, $3'
 * @example placeholders(1)  // '$1'
 * @example placeholders(0)  // ''
 */
function placeholders (n) {
  return n > 0 ? [...range(1, n)].map(n => `$${n}`).join(', ') : ''
}

/** Get columns-values in the form [ [columns], [values] ]
 * Order correspondence with the real database is not guaranteed
 * @param {*} ent - Entity instance
 * @param {Array<String>} columns - Columns to be considered
 * @returns {Array<Array>}
 */
function entityCV (ent, columns) {
  const cols = []; const vals = []
  for (const col of columns) {
    cols.push(col)
    vals.push(ent[col])
  }
  return [cols, vals]
}

/** Is something implementing the iterable protocol?
 * @param {*} o - Object to inspect
 * @returns {boolean} Is the object iterable?
 */
function isIterable (o) {
  return !!((o && typeof o[Symbol.iterator] === 'function'))
}

/** Create a new Set instance being the union of this Set and an iterable
 * collection
 * @param {Iterable} other - An iterable collection
 * @throws 'other' must be iterable
 * @returns {Set} The union between this Set instance and 'other'
 */
Set.prototype.union = function (other) {
  if (!isIterable(other)) { throw new TypeError('Other collection must be iterable') }
  const ret = new Set(this)
  for (const elem of other) { ret.add(elem) }
  return ret
}

/** Compare this Set to another Set instance
 * @param {Set} other - The other Set instance
 * @returns {boolean} true if the two Sets contain the same elements, false if
 *   not or if 'other' is not a Set
 */
Set.prototype.equals = function (other) {
  if (!(other instanceof Set) || other.size !== this.size) { return false }
  for (const e of this) { if (!other.has(e)) return false }
  return true
}

module.exports = {
  range, placeholders, entityCV, isIterable
}
