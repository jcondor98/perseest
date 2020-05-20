// Copyright 2020 Paolo Lucchesi
// All rights reserved
// This software is licensed under the MIT license found in the file LICENSE
// in the root directory of this repository
/** Flexible interface for persistent entities using ES6 classes and mixins
 * and Brian Carlson's node-postgres
 * @module perseest
 * @author jcondor */
'use strict'
module.exports = {
  Class: require('./lib/perseest').PerseestClass,
  Mixin: require('./lib/perseest').PerseestMixin,
  Query: require('./lib/PerseestQuery'),
  Hooks: require('./lib/PerseestHooks'),
  Config: require('./lib/PerseestConfig'),
  Parameters: require('./lib/QueryParameters')
}
