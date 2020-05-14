'use strict';
const Perseest = require('./perseest');


class ConfigFactory {
  static create(opt = {}) {
    const props = Object.getOwnPropertyNames(opt);
    const primaryKey = props.includes('primaryKey') ?
      opt.primaryKey : this.init.primaryKey;
    const table = props.includes('table') ?
      opt.table : this.init.table;
    const ids = props.includes('ids') ?
      opt.ids : this.init.ids;
    const columns = props.includes('columns') ?
      opt.columns : this.init.columns;

    return new Perseest.Config(table, primaryKey, { ids: ids, columns: columns });
  }


  static init = {}; // To be set by the test unit
}


module.exports = { ConfigFactory };
