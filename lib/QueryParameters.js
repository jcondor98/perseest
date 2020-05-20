/** Perseest query parameters type definition
 * @author jcondor
 * @license
 * Copyright 2020 Paolo Lucchesi
 * All rights reserved
 * This software is licensed under the MIT license found in the file LICENSE
 * in the root directory of this repository
 */
class QueryParameters {
  #_columns;
  #_values;

  /** Parameters to be passed to a before/after query hook
   * NOTE: Undefined or null values will be accepted for every argument,
   *   however this could lead to weird behaviours if something tries to access
   *   them (e.g. both 'ent' and 'key' are null and 'key' is accessed)
   * @param {object} opt - Arguments
   * @param {PerseestConfig} opt.conf - Perseest configuration for
   *   the entity class
   * @param {object} opt.res - postgres response
   * @param {object} opt.ent - Persistent entity (one)
   * @param {Array} opt.entities - Persistent entities (many)
   * @param {string} opt.key - Univocal identifier column name
   * @param {*} opt.kval - Value for 'key'
   * @param {Iterable<String>} opt.columns - Names of the columns to treat
   * @param {Iterable} opt.values - Values for 'columns', passed in order
   */
  constructor({ conf=null, res=null, key=null, kval=null,
    ent=null, entities=null, columns=null, values=null } = {}) {
    this.conf = conf;
    this.res = res;
    this.entities = entities;
    this.ent = ent || (entities ? entities[0] : null);
    this.key = key || this.conf.primaryKey;
    this.kval = (kval || kval === 0) ? kval : (ent ? ent[this.key] : null);
    this.#_columns = columns ? [...columns] : null;
    this.#_values = values ? [...values] : null;
  }

  get columns() {
    if (!this.#_columns) { // Column-value indexing must be consistent, init both
      this.#_columns = [...this.conf.columns];
      this.#_values  = this.#_columns.map(c => this.ent[c]);
    }
    return this.#_columns;
  }

  get values() {
    if (!this.#_values) {
      if (!this.#_columns)
        this.#_columns = [...this.conf.columns];
      this.#_values  = this.#_columns.map(c => this.ent[c]);
    }
    return this.#_values;
  }
}


module.exports = QueryParameters
