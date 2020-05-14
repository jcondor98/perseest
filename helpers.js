// Copyright 2020 Paolo Lucchesi
// All rights reserved
// This software is licensed under the MIT license found in the file LICENSE
// in the root directory of this repository
/** Perseest helpers module
 * @module perseest/helpers
 * @requires pg
 * @requires validate.js
 * @author jcondor */
'use strict'


// Generate values from 'start' to 'stop' (both inclusive)
function *range(start, stop) {
  for (let i=start; i <= stop; ++i)
    yield i;
}


// Return a string of 'n' placeholders for a parameterized query
function placeholders(n) {
  return [...range(1,n)].map(n => `$${n}`).join(', ');
}

// Get columns-values in the form [ [columns], [values] ]
// Order correspondence with the real database is not guaranteed
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

// Is something implementing the iterable protocol?
function isIterable(o) {
  return o && typeof o[Symbol.iterator] === 'function';
}


// Superpowers for Set (other stuff may be added when the need arises)
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
