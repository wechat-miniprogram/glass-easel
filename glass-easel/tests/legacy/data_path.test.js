/* eslint-disable */

const { execWithWarn, execWithError } = require('../base/env')
const glassEasel = require('../../src')

describe('DataPath', function () {
  describe('#parseSinglePaths', function () {
    it('should parse single path segment', function () {
      var str = ' _ '
      var expected = [' _ ']
      expect(glassEasel.dataPath.parseSinglePath(str)).toStrictEqual(expected)
    })

    it('should parse dots', function () {
      var str = '_2a1.bb.3c\\'
      var expected = ['_2a1', 'bb', '3c\\']
      expect(glassEasel.dataPath.parseSinglePath(str)).toStrictEqual(expected)
    })

    it('should parse escaped chars', function () {
      var str = ' a\\.\\*\\ b'
      var expected = [' a.\\*\\ b']
      expect(glassEasel.dataPath.parseSinglePath(str)).toStrictEqual(expected)
    })

    it('should parse indexes', function () {
      var str = 'a [0]. [12]'
      var expected = ['a ', 0, ' ', 12]
      expect(glassEasel.dataPath.parseSinglePath(str)).toStrictEqual(expected)
    })

    it('fails at illegal integers', function () {
      execWithError(function () {
        var str = 'a[b]'
        expect(glassEasel.dataPath.parseSinglePath(str)).toStrictEqual(null)
      }, 'data path descriptor "a[b]" is illegal at char 2 (illegal index)')
    })

    it('fails at illegal integer suffixes', function () {
      execWithError(function () {
        var str = 'a[1e]'
        expect(glassEasel.dataPath.parseSinglePath(str)).toStrictEqual(null)
      }, 'data path descriptor "a[1e]" is illegal at char 3 (illegal index)')
    })

    it('should parse empty str', function () {
      var str = ''
      expect(glassEasel.dataPath.parseSinglePath(str)).toStrictEqual([''])
    })

    it('should parse empty subfields', function () {
      var str = 'a.'
      expect(glassEasel.dataPath.parseSinglePath(str)).toStrictEqual(['a'])
    })
  })

  describe('#parseMultiPaths', function () {
    it('should parse single path segment', function () {
      var str = ' _ '
      var expected = [['_']]
      expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual(expected)
    })

    it('should parse dots', function () {
      var str = '_2a1 . bb.c3\\'
      var expected = [['_2a1', 'bb', 'c3']]
      expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual(expected)
    })

    it('should parse indexes', function () {
      var str = 'a [ 0 ] [12]'
      var expected = [['a', 0, 12]]
      expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual(expected)
    })

    it('should parse commas', function () {
      var str = ' a.b[0], c[1].d, ** '
      var expected = [['a', 'b', 0], ['c', 1, 'd'], ['**']]
      expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual(expected)
    })

    it('should parse wildcards', function () {
      var str = ' a[1].**, b ._[1], c . __ . d '
      var expected = [
        ['a', 1, '**'],
        ['b', '_', 1],
        ['c', '__', 'd'],
      ]
      expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual(expected)
    })

    it('should parse escaped chars', function () {
      var str = ' a\\.\\*\\ b'
      var expected = [['a.* b']]
      expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual(expected)
    })

    it('fails at illegal integers', function () {
      execWithError(function () {
        var str = 'a[b]'
        expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual([])
      }, 'data path descriptor "a[b]" is illegal at char 2 (illegal index)')
    })

    it('fails at illegal integer suffixes', function () {
      execWithError(function () {
        var str = 'a[1e]'
        expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual([])
      }, 'data path descriptor "a[1e]" is illegal at char 3 (illegal index)')
    })

    it('fails at number-started fields', function () {
      execWithError(function () {
        var str = '1a'
        expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual([])
      }, 'data path descriptor "1a" is illegal at char 0 (field name cannot start with digits)')
    })

    it('fails at number-started subfields', function () {
      execWithError(function () {
        var str = 'b.1a'
        expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual([])
      }, 'data path descriptor "b.1a" is illegal at char 2 (field name cannot start with digits)')
    })

    it('fails at empty str', function () {
      execWithError(function () {
        var str = ''
        expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual([])
      }, 'data path descriptor "" is illegal at char 0 (first field name illegal)')
    })

    it('fails at empty subfields', function () {
      execWithError(function () {
        var str = 'a.'
        expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual([])
      }, 'data path descriptor "a." is illegal at char 2 (field name illegal)')
    })

    it('fails at extra chars', function () {
      execWithError(function () {
        var str = 'a.b*'
        expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual([])
      }, 'data path descriptor "a.b*" is illegal at char 3')
    })
  })
})
