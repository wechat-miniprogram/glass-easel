import { ChannelEventType } from '../../src/channel_protocol'
import type { StringRef } from '../../src/channel_protocol'
import { StreamTransportBridge } from '../../src/transport_bridge'
import type { Scheduler, StreamPayload } from '../../src/transport_bridge'

/*
 * The string table of `StreamTransportBridge`: a string travels inline the
 * first time, gets a table slot when it shows up again, the sender-side
 * candidate set is bounded, and a full table ends the epoch.
 *
 * Every test links two bridges, JSON-round-trips each payload (modelling a real
 * transport) and decodes the received operations through the receiving bridge,
 * so a wrong table handling shows up as a wrong string, not just a bookkeeping
 * offset.
 */

class ManualScheduler implements Scheduler {
  private _pending = false
  private _flushHandler: (() => void) | null = null

  schedule() {
    this._pending = true
  }

  onFlush(handler: () => void) {
    this._flushHandler = handler
  }

  get pending() {
    return this._pending
  }

  flush() {
    if (!this._pending) return
    this._pending = false
    this._flushHandler!()
  }
}

type Bridge = StreamTransportBridge<ChannelEventType, ChannelEventType>

interface Decoded {
  kind: string
  [k: string]: unknown
}

interface Pair {
  a: Bridge
  b: Bridge
  sentAToB: Decoded[]
  sentBToA: Decoded[]
  payloads: StreamPayload[]
  flush(): void
}

/** Operations with string arguments the tests use, decoded on the receiving side. */
const makeHandlers = (receiver: Bridge, records: Decoded[]) =>
  new Proxy(
    {},
    {
      get: (_target, prop) => {
        if (typeof prop !== 'string') return undefined
        const op = Number(prop)
        return (...args: any[]) => {
          switch (op) {
            case ChannelEventType.SET_ID:
              records.push({ kind: 'setId', id: args[0], value: receiver.decodeString(args[1]) })
              break
            case ChannelEventType.ADD_CLASS:
              records.push({ kind: 'addClass', id: args[0], value: receiver.decodeString(args[1]) })
              break
            case ChannelEventType.SET_ATTRIBUTE:
              records.push({
                kind: 'setAttribute',
                id: args[0],
                name: receiver.decodeString(args[1]),
                value: args[2],
              })
              break
            case ChannelEventType.SET_CLASS_ALIAS:
              records.push({
                kind: 'classAlias',
                id: args[0],
                className: receiver.decodeString(args[1]),
                target: (args[2] as StringRef[]).map((x) => receiver.decodeString(x)),
              })
              break
            case ChannelEventType.UPDATE_DYNAMIC_SLOT:
              records.push({
                kind: 'updateSlot',
                id: args[0],
                changedNames: (args[2] as StringRef[]).map((x) => receiver.decodeString(x)),
              })
              break
            default:
              records.push({ kind: 'other', op, args })
          }
        }
      },
    },
  )

const makePair = (maxInterned?: number): Pair => {
  let incomingForA: ((p: StreamPayload) => void) | null = null
  let incomingForB: ((p: StreamPayload) => void) | null = null
  const schedA = new ManualScheduler()
  const schedB = new ManualScheduler()
  const payloads: StreamPayload[] = []

  const a = new StreamTransportBridge(
    (p) => {
      payloads.push(JSON.parse(JSON.stringify(p)))
      incomingForB?.(JSON.parse(JSON.stringify(p)))
    },
    (h) => {
      incomingForA = h
    },
    schedA,
    maxInterned,
  )
  const b = new StreamTransportBridge(
    (p) => {
      payloads.push(JSON.parse(JSON.stringify(p)))
      incomingForA?.(JSON.parse(JSON.stringify(p)))
    },
    (h) => {
      incomingForB = h
    },
    schedB,
    maxInterned,
  )

  const sentAToB: Decoded[] = []
  const sentBToA: Decoded[] = []
  a.subscribeHandler(makeHandlers(a, sentBToA) as any)
  b.subscribeHandler(makeHandlers(b, sentAToB) as any)

  const flush = () => {
    // a synchronous transport may publish while delivering, so keep flushing
    // until both directions are quiet
    for (let i = 0; i < 8 && (schedA.pending || schedB.pending); i += 1) {
      schedA.flush()
      schedB.flush()
    }
  }
  return { a, b, sentAToB, sentBToA, payloads, flush }
}

/** Deterministic PRNG (Park-Miller) so failures are reproducible. */
const makeRandom = (seed: number) => {
  const state = { x: seed % 2147483647 }
  return () => {
    state.x = (state.x * 16807) % 2147483647
    return (state.x - 1) / 2147483646
  }
}

const tableSize = (bridge: Bridge) =>
  (bridge as unknown as { sendStringMap: Map<string, number> }).sendStringMap.size
const recvTableSize = (bridge: Bridge) =>
  (bridge as unknown as { recvStrings: unknown[] }).recvStrings.length

describe('StreamTransportBridge string table', () => {
  test('first occurrence goes inline, second occurrence is interned', () => {
    const pair = makePair()
    pair.a.publish(ChannelEventType.ADD_CLASS, 1, pair.a.encodeString('only-once'))
    pair.a.publish(ChannelEventType.ADD_CLASS, 2, pair.a.encodeString('repeated'))
    pair.a.publish(ChannelEventType.ADD_CLASS, 3, pair.a.encodeString('repeated'))
    pair.flush()

    const [ops, strings] = pair.payloads[0]!
    expect(strings).toEqual(['repeated'])
    // the inline first occurrence, then a reference to the interned one
    expect(ops[2]).toBe('only-once')
    expect(ops[5]).toBe('repeated')
    expect(typeof ops[8]).toBe('number')
    expect(pair.b.decodeString(ops[8] as StringRef)).toBe('repeated')
    expect(pair.sentAToB.map((r) => r.value)).toEqual(['only-once', 'repeated', 'repeated'])
  })

  test('one-shot strings never enter either table', () => {
    const pair = makePair()
    for (let i = 0; i < 5000; i += 1) {
      pair.a.publish(ChannelEventType.SET_ID, i, pair.a.encodeString(`_s${i}`))
    }
    pair.flush()
    expect(tableSize(pair.a)).toBe(0)
    expect(recvTableSize(pair.b)).toBe(0)
    expect(pair.sentAToB).toHaveLength(5000)
    expect(pair.sentAToB[4999]!.value).toBe('_s4999')
  })

  test('repeated strings are interned once and the candidate set stays bounded', () => {
    const pair = makePair()
    for (let i = 0; i < 20000; i += 1) {
      const s = `n${i % 100}`
      pair.a.publish(ChannelEventType.ADD_CLASS, i, pair.a.encodeString(s))
      pair.a.publish(ChannelEventType.ADD_CLASS, i, pair.a.encodeString(s))
    }
    pair.flush()
    expect(tableSize(pair.a)).toBe(100)
    expect(recvTableSize(pair.b)).toBe(100)
    const candidates = (pair.a as unknown as { candidates: Set<string> }).candidates
    expect(candidates.size).toBeLessThanOrEqual(2048)
  })

  test('random full-duplex streams decode back to the originals', () => {
    const pair = makePair(64)
    const rnd = makeRandom(0x5eed)
    const expectedAToB: Decoded[] = []
    const expectedBToA: Decoded[] = []
    let checkedA = 0
    let checkedB = 0
    const pick = (batch: number, i: number) => {
      const r = rnd()
      if (r < 0.35) return `hot-${Math.floor(rnd() * 6)}`
      if (r < 0.7) return `warm-${Math.floor(rnd() * 200)}`
      return `once-${batch}-${i}`
    }
    for (let batch = 0; batch < 400; batch += 1) {
      for (let i = 0; i < Math.floor(rnd() * 30); i += 1) {
        const s = pick(batch, i)
        const v = pick(batch, i)
        switch (Math.floor(rnd() * 4)) {
          case 0:
            pair.a.publish(ChannelEventType.SET_ID, i, pair.a.encodeString(s))
            expectedAToB.push({ kind: 'setId', id: i, value: s })
            break
          case 1:
            pair.a.publish(ChannelEventType.ADD_CLASS, i, pair.a.encodeString(s))
            expectedAToB.push({ kind: 'addClass', id: i, value: s })
            break
          case 2:
            // attribute values are plain values, only the name is interned
            pair.a.publish(ChannelEventType.SET_ATTRIBUTE, i, pair.a.encodeString(s), v)
            expectedAToB.push({ kind: 'setAttribute', id: i, name: s, value: v })
            break
          default:
            pair.a.publish(ChannelEventType.SET_CLASS_ALIAS, i, pair.a.encodeString(s), [
              pair.a.encodeString(s),
              pair.a.encodeString(v),
            ])
            expectedAToB.push({ kind: 'classAlias', id: i, className: s, target: [s, v] })
        }
        // the other direction runs the same way
        const s2 = pick(batch, i)
        pair.b.publish(ChannelEventType.ADD_CLASS, i, pair.b.encodeString(s2))
        expectedBToA.push({ kind: 'addClass', id: i, value: s2 })
      }
      pair.flush()
      expect(pair.sentAToB.slice(checkedA)).toEqual(expectedAToB.slice(checkedA))
      expect(pair.sentBToA.slice(checkedB)).toEqual(expectedBToA.slice(checkedB))
      checkedA = expectedAToB.length
      checkedB = expectedBToA.length
      // tables are capped: the receiver lags the sender by at most one payload
      expect(tableSize(pair.a)).toBeLessThanOrEqual(64)
      expect(recvTableSize(pair.b)).toBeLessThanOrEqual(64 + 30)
    }
    expect(tableSize(pair.a)).toBeGreaterThan(0)
  })

  test('a full table starts a new epoch and the stream still decodes', () => {
    const cap = 8
    const pair = makePair(cap)
    const expected: Decoded[] = []
    const names = Array.from({ length: cap + 4 }, (_, i) => `n${i}`)
    // this batch interns past the cap and keeps referring to the new ids
    for (let round = 0; round < 3; round += 1) {
      names.forEach((s) => {
        pair.a.publish(ChannelEventType.ADD_CLASS, round, pair.a.encodeString(s))
        expected.push({ kind: 'addClass', id: round, value: s })
      })
    }
    pair.flush()
    expect(pair.sentAToB).toEqual(expected)
    // the next payload carries the epoch flag and starts from an empty table
    pair.a.publish(ChannelEventType.ADD_CLASS, 9, pair.a.encodeString(names[0]!))
    pair.a.publish(ChannelEventType.ADD_CLASS, 9, pair.a.encodeString(names[0]!))
    expected.push({ kind: 'addClass', id: 9, value: names[0]! })
    expected.push({ kind: 'addClass', id: 9, value: names[0]! })
    pair.flush()
    const last = pair.payloads[pair.payloads.length - 1]!
    expect(last[2]).toBe(1)
    expect(pair.sentAToB).toEqual(expected)
    // round-tripped through the flag, both sides agree again
    expect(tableSize(pair.a)).toBe(1)
    expect(recvTableSize(pair.b)).toBe(1)
  })

  test('a repeat across an epoch boundary is decoded from the new table', () => {
    const pair = makePair(2)
    const seen: Decoded[] = []
    for (let i = 0; i < 200; i += 1) {
      ;[`a${i % 3}`, `a${i % 3}`, `b${i % 5}`, `b${i % 5}`, `c${i}`].forEach((s) => {
        pair.a.publish(ChannelEventType.SET_ID, i, pair.a.encodeString(s))
        seen.push({ kind: 'setId', id: i, value: s })
      })
      pair.flush()
      expect(pair.sentAToB).toEqual(seen)
    }
    expect(pair.payloads.some((p) => p[2] === 1)).toBe(true)
  })

  test('reset flags the next payload so the peer drops its table', () => {
    const pair = makePair()
    ;['x', 'x', 'y', 'y'].forEach((s) => {
      pair.a.publish(ChannelEventType.ADD_CLASS, 0, pair.a.encodeString(s))
    })
    pair.flush()
    expect(recvTableSize(pair.b)).toBe(2)

    pair.a.reset()
    pair.a.publish(ChannelEventType.ADD_CLASS, 0, pair.a.encodeString('x'))
    pair.a.publish(ChannelEventType.ADD_CLASS, 0, pair.a.encodeString('x'))
    pair.flush()
    const last = pair.payloads[pair.payloads.length - 1]!
    expect(last[2]).toBe(1)
    // the receiver replaced its table: only the re-interned string is in it
    expect(recvTableSize(pair.b)).toBe(1)
    expect(pair.sentAToB[pair.sentAToB.length - 1]).toEqual({
      kind: 'addClass',
      id: 0,
      value: 'x',
    })
  })
})
