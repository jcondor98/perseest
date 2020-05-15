// perseest - Test Unit for helpers
// Uses mocha as the main testing framework and expect.js as the assert library
// jcondor (Paolo Lucchesi)
'use strict';
const expect = require('expect.js');
const help = require('../lib/helpers');

describe('Helper function', function() {
  describe('range', function() {
    it('should return a single number if start === stop', () => {
      expect([...help.range(4,4)]).to.eql([4]);
      expect([...help.range(0,0)]).to.eql([0]);
      expect([...help.range(-2,-2)]).to.eql([-2]);
    });

    it('should return an ascending range if start < stop', () => {
      expect([...help.range(1,4)]).to.eql([1,2,3,4]);
      expect([...help.range(-2,0)]).to.eql([-2,-1,0]);
      expect([...help.range(-4,-2)]).to.eql([-4,-3,-2]);
    });

    it('should return a descending range if start > stop', () => {
      expect([...help.range(4,1)]).to.eql([4,3,2,1]);
      expect([...help.range(0,-2)]).to.eql([0,-1,-2]);
      expect([...help.range(-6,-8)]).to.eql([-6,-7,-8]);
    });
  });


  describe('placeholders', function() {
    it('should return an empty string if n <= 0', () => {
      expect(help.placeholders(0)).to.equal('');
      expect(help.placeholders(-5)).to.equal('');
    });

    it('should return exactly \'$1\' if n === 1', () =>
      expect(help.placeholders(1)).to.match(/^ *\$1 *$/));

    it('should return n comma-separated placeholders if n > 1', () => {
      expect(help.placeholders(2)).to.match(/^ *\$1 *, *\$2 *$/);
      expect(help.placeholders(4)).to.match(/^ *\$1 *, *\$2 *, *\$3 *, *\$4 *$/);
    });
  });


  describe('isIterable', function() {
    [ ['an object', { a: 1, b: 2 },   false],
      ['undefined', undefined,        false],
      ['null',      null,             false],
      ['a string',  'Homer Simpson',  true],
      ['a Set',     new Set([1,2,3]), true],
      ['a Map',     new Map([['a',1],['b',2]]), true],
      ['an array',  [1,2,3], true],
      ['an empty array', [], true],
    ].forEach(([testCase, value, expected]) =>
      specify(`should return ${expected} when its argument is ${testCase}`, () =>
        expect(help.isIterable(value)).to.be(expected)));
  });
});
