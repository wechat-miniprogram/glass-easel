/* eslint-disable */

const { execWithWarn } = require('../base/env')
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
      execWithWarn(1, function () {
        var str = 'a[b]'
        expect(glassEasel.dataPath.parseSinglePath(str)).toStrictEqual(null)
      })
    })

    it('fails at illegal integer suffixes', function () {
      execWithWarn(1, function () {
        var str = 'a[1e]'
        expect(glassEasel.dataPath.parseSinglePath(str)).toStrictEqual(null)
      })
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
      execWithWarn(1, function () {
        var str = 'a[b]'
        expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual([])
      })
    })

    it('fails at illegal integer suffixes', function () {
      execWithWarn(1, function () {
        var str = 'a[1e]'
        expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual([])
      })
    })

    it('fails at number-started fields', function () {
      execWithWarn(1, function () {
        var str = '1a'
        expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual([])
      })
    })

    it('fails at number-started subfields', function () {
      execWithWarn(1, function () {
        var str = 'b.1a'
        expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual([])
      })
    })

    it('fails at empty str', function () {
      execWithWarn(1, function () {
        var str = ''
        expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual([])
      })
    })

    it('fails at empty subfields', function () {
      execWithWarn(1, function () {
        var str = 'a.'
        expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual([])
      })
    })

    it('fails at extra chars', function () {
      execWithWarn(1, function () {
        var str = 'a.b*'
        expect(glassEasel.dataPath.parseMultiPaths(str)).toStrictEqual([])
      })
    })
  })
})
