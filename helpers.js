// Copyright 2020 Paolo Lucchesi
// All rights reserved
// This software is licensed under the MIT license found in the file LICENSE
// in the root directory of this repository
/** Perseest helpers module
 * @module perseest/helpers
 * @author jcondor */
'use strict'


/** Generate values from 'start' to 'stop' (both inclusive)
 * @param {number} start
 * @param {number} stop
 * @returns {Generator} The previous value incremented by 1 at each iteration
 */
function *range(start, stop) {
  for (let i=start; i <= stop; ++i)
    yield i;
}


/** Return a string of 'n' placeholders for a parameterized query
 * @param {number} n - Number of values for which placeholders must be generated
 * @returns {string} A string in the form '$1, $2, $3, ... , $n'
 */
function placeholders(n) {
  return [...range(1,n)].map(n => `$${n}`).join(', ');
}

/** Get columns-values in the form [ [columns], [values] ]
 * Order correspondence with the real database is not guaranteed
 * @param {*} ent - Entity instance
 * @param {Array<String>} columns - Columns to be considered
 * @returns {Array<Array>}
 */
function entityCV(ent, columns) {
  let cols=[], vals=[];
  for (const col of columns) {
    cols.push(col);
    vals.push(ent[col]);
  }
  return [cols, vals];
}

/*
// Get columns-values in the form [ [column,value], ... ]
// Order correspondence with the real database is not guaranteed
function entityZippedCV(ent, columns) {
  return columns.map(c => [c,ent[c]]);
}
*/

/** Is something implementing the iterable protocol?
 * @param {*} o - Object to inspect
 * @returns {boolean} Is the object iterable?
 */
function isIterable(o) {
  return o && typeof o[Symbol.iterator] === 'function';
}


// Superpowers for Set (other stuff may be added when the need arises)

/** Create a new Set instance being the union of this Set and an iterable
 * collection
 * @param {Iterable} other - An iterable collection
 * @throws 'other' must be iterable
 * @returns {Set} The union between this Set instance and 'other'
 */
Set.prototype.union = function(other) {
  if (!isIterable(other))
    throw new TypeError('Other collection must be iterable');
  const ret = new Set(this);
  for (const elem of other)
    ret.add(elem);
  return ret;
}


module.exports = {
  range, placeholders, entityCV, isIterable
};
