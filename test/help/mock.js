// perseest - Setup routines and common stuff for test units
// jcondor (Paolo Lucchesi)
'use strict';
const PerseestClass = require('../../lib/perseest').PerseestClass;
const ConfigFactory = require('./factories').Config;

class Mock extends PerseestClass {
  constructor({ id=null, msg=null, msg2=null, uniq=null } = {}) {
    super();
    this.id = id || this.constructor.id++;
    this.msg = msg || 'abcde';
    this.msg2 = msg2 || 'fghijk';
    this.uniq = uniq || this.id;
  }

  static id = 0;
  static db = ConfigFactory.create();
}


module.exports = { Mock };
