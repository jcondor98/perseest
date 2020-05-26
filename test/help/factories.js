// perseest - Factories for test units
// jcondor (Paolo Lucchesi)
'use strict';
const Config = require('../../lib/PerseestConfig');


class ConfigFactory {
  static create(opt = {}) {
    const props = Object.getOwnPropertyNames(opt);
    const primaryKey = props.includes('primaryKey') ?
      opt.primaryKey : this.init.primaryKey;
    const table = props.includes('table') ?
      opt.table : this.init.table;
    const columns = props.includes('columns') ?
      opt.columns : this.init.columns;

    return new Config(table, primaryKey, { columns });
  }

  // TODO: Make this flexible
  static init = {
    table: 'Mockies',
    primaryKey: 'id',
    columns: ['msg', 'msg2', ['uniq', { id: true }]],
  };
}


module.exports = { Config: ConfigFactory };
