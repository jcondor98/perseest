// perseest - Factories for test units
// jcondor (Paolo Lucchesi)
'use strict';
const Perseest = require('../../lib/perseest');


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

  // TODO: Make this flexible
  static init = {
    table: 'Mockies',
    primaryKey: 'id',
    columns: ['msg', 'msg2'],
    ids: ['uniq']
  };
}


class PerseestFactory {
  static createClass() {
    return class extends Perseest.Class {
      static db = ConfigFactory.create();
    }
  }
}


module.exports = { Perseest: PerseestFactory, Config: ConfigFactory};
