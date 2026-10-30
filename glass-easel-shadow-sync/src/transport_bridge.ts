/*
 * Transport layer of a shadow-sync channel.
 *
 * `MessageChannelDataSide` / `MessageChannelViewSide` (see `message_channel.ts`)
 * turn glass-easel backend calls into typed `publish(OP, ...args)` calls; this
 * module owns what actually goes on the wire. It packs the arguments of every
 * operation into one flat op stream, shortens the strings in it, and hands the
 * result to a plain `[ops, strings]` transport (the demo `Bridge`, the worker
 * channel, the synchronous test bridge, ...).
 *
 * Both directions use the same encoding, so a bridge is full duplex: `publish`
 * encodes, `subscribeHandler` decodes. A transport never sees a
 * `ChannelEventType`, only numbers and JSON-safe values.
 */
import {
  ARITY,
  type ChannelEventHandlers,
  type ChannelEventType,
  type StringRef,
} from './channel_protocol'

/**
 * One payload of a stream.
 *
 * `ops` is the flat run of `[op, arg, ...]` slots, `strings` are the strings the
 * payload announces, and the third slot is `1` when the payload starts a new
 * string epoch: the receiver then replaces its whole table with `strings`
 * instead of appending them (see `StreamTransportBridge`).
 */
export type StreamPayload = [ops: unknown[], strings: string[], startsEpoch?: 1]

/**
 * The only thing a channel needs from the outside world.
 *
 * Implementations move opaque `[ops, strings]` payloads between the two sides:
 * `publish` sends one, `subscribeHandler` installs the receiver. Encoding,
 * batching and string interning stay inside the bridge, so a transport can be
 * as dumb as `postMessage` or a direct function call.
 */
export interface TransportBridge<
  PublishType extends ChannelEventType,
  ReceiveType extends ChannelEventType,
> {
  /** Intern a string for the outgoing direction (references are per bridge). */
  encodeString: (str: string) => StringRef
  /** Resolve a reference received from the peer. */
  decodeString: (ref: StringRef) => string
  publish: Publisher<PublishType>
  subscribeHandler(handler: SideHandlers<ReceiveType>): void
  /** Forget both string tables and the pending stream (see `StreamTransportBridge`). */
  reset(): void
}

/**
 * The publishing half of a channel.
 *
 * `publish(OP, ...args)` is fully typed: the first argument selects the
 * operation and fixes the number and types of the remaining arguments.
 * There is no array to build at the call site, so a producer does not pay
 * for the transport encoding of the command.
 */
type Publisher<Side extends ChannelEventType> = (
  ...args: {
    [T in Side]: [T, ...Parameters<ChannelEventHandlers[T]>]
  }[Side]
) => void

/**
 * Handler map of one side of the channel.
 *
 * Every operation of the side must have a handler, which makes the consumer
 * exhaustive at compile time. Handlers receive the arguments of the operation
 * one by one, exactly like `publish` takes them: an entry of the map is simply
 * the function type declared in the args table, so the args table doubles as
 * the handler signature table.
 */
export type SideHandlers<Side extends ChannelEventType> = Pick<ChannelEventHandlers, Side>

/**
 * Decides when a pending stream is flushed.
 *
 * Production uses `MicroTaskScheduler`, which batches everything produced in
 * one task into a single payload. A test that needs a deterministic point of
 * flush implements this interface itself and calls its own `flush` (see the
 * synchronous bridge in `tests/base/env.ts` and `replay`).
 */
export interface Scheduler {
  schedule(): void
  onFlush(cb: () => void): void
}

/**
 * A `Scheduler` that flushes the pending stream at the end of the current microtask.
 *
 * `schedule` is idempotent within a task: the first publish of a batch pays for
 * the microtask, the rest only append to the stream.
 */
export class MicroTaskScheduler implements Scheduler {
  private _pending = false
  private _flushHandler: (() => void) | null = null

  flush() {
    this._pending = false
    this._flushHandler?.()
  }

  schedule() {
    if (this._pending) return
    this._pending = true
    // eslint-disable-next-line @typescript-eslint/no-floating-promises,promise/catch-or-return,promise/always-return
    Promise.resolve().then(() => {
      this.flush()
    })
  }

  onFlush(handler: () => void) {
    this._flushHandler = handler
  }
}

/** Upper bound of the "seen once" candidate set (it is cleared when exceeded). */
const CANDIDATE_LIMIT = 2048
/** Upper bound of the interned table; a full table ends the epoch. */
const MAX_INTERNED = 2048

/**
 * Encodes outgoing operations into a compact stream and replays incoming ones.
 *
 * Outgoing operations (`publish`) are appended to `streamOps` as
 * `[op, arg, arg, ...]` slots and flushed as a single payload per scheduled
 * flush, so one message carries a whole batch of DOM operations instead of one
 * message per operation.
 *
 * A string slot in the stream is one of two things: the string itself, or the
 * negative reference `-1 - id` into the table the peer announced. The two never
 * collide (references are numbers), so the receiver needs no policy of its own
 * and the sender needs no round trip.
 *
 * A string travels inline the *first* time and earns a table slot only when it
 * shows up a second time. Genuinely repeated strings (tag / class / attribute /
 * event names) therefore cost a single reference from their third occurrence
 * on, while one-shot strings — a unique `SET_ID` sid, a per-node
 * `node-b-<id>` class, ... — never enter either table. Interning on first
 * sight instead would keep every such string alive on both sides for the
 * lifetime of the channel.
 *
 * The "seen once" candidate set is bounded (`CANDIDATE_LIMIT`): when it is
 * exceeded it is cleared, and a repeat that falls on the other side of a clear
 * is simply shipped inline again (and becomes a candidate again). The failure
 * mode is a few extra bytes, never a wrong decode.
 *
 * The interned table is bounded as well (`maxInterned`). A full table ends the
 * epoch at the next flush: the sender drops its table, and the payload after it
 * carries the `startsEpoch` flag, so the receiver replaces its table with that
 * payload's strings. Because only repeated strings ever get a slot, this is a
 * safety valve rather than a policy — it usually never triggers — and unlike a
 * plain periodic reset it does not re-send the strings of live nodes.
 *
 * The two directions have independent tables, and `reset` clears both.
 */
export class StreamTransportBridge<
  PublishType extends ChannelEventType,
  ReceiveType extends ChannelEventType,
> implements TransportBridge<PublishType, ReceiveType>
{
  // outgoing direction: interned strings and their wire id
  private sendStringId = 0
  private sendStringMap = new Map<string, number>()
  private pendingStrings: string[] = []
  // outgoing direction: strings seen once, candidates for interning
  private candidates = new Set<string>()
  // whether the next outgoing payload starts a new epoch
  private pendingEpoch = false
  // incoming direction: strings announced by the peer, indexed by interned id
  private recvStrings: string[] = []
  // pending `[op, ...args]` slots, flushed as one payload
  private streamOps: unknown[] = []

  /**
   * `maxInterned` bounds the interned table; it is only lowered by tests that
   * need the epoch reset to happen within a few batches.
   */
  constructor(
    publish: (arg: StreamPayload) => void,
    private subscribe: (handler: (arg: StreamPayload) => void) => void,
    private scheduler: Scheduler,
    private maxInterned = MAX_INTERNED,
  ) {
    scheduler.onFlush(() => {
      const ops = this.streamOps
      const str = this.pendingStrings
      const startsEpoch = this.pendingEpoch
      // take the buffers before publishing: a synchronous transport may deliver
      // the payload (and publish more operations) before `publish` returns
      this.streamOps = []
      this.pendingStrings = []
      this.pendingEpoch = false
      // a full table ends the epoch *after* this payload, so the payload being
      // published still refers to the table its peer has
      if (this.sendStringMap.size >= this.maxInterned) this.beginEpoch()
      if (startsEpoch) publish([ops, str, 1])
      else publish([ops, str])
    })
  }

  /**
   * Encode a string for the outgoing stream.
   *
   * Interned strings become a negative reference; a first occurrence travels
   * inline (as the string itself) and only becomes a reference if it shows up
   * again later.
   */
  encodeString(s: string): StringRef {
    const id = this.sendStringMap.get(s)
    if (id !== undefined) return (-1 - id) as StringRef
    if (this.candidates.has(s)) {
      const newId = this.sendStringId
      this.sendStringId += 1
      this.pendingStrings.push(s)
      this.sendStringMap.set(s, newId)
      this.candidates.delete(s)
      return (-1 - newId) as StringRef
    }
    // not proven to repeat yet: ship it inline
    this.candidates.add(s)
    if (this.candidates.size > CANDIDATE_LIMIT) this.candidates.clear()
    return s as unknown as StringRef
  }

  /**
   * Resolve a slot against the table announced by the peer.
   *
   * A string slot is already the value (inline first occurrence); anything else
   * is a negative reference.
   */
  decodeString(ref: StringRef): string {
    if (typeof ref === 'string') return ref
    return this.recvStrings[-1 - ref]!
  }

  /**
   * Append an operation to the pending stream.
   *
   * Every operation takes this path, not just the DOM hot path, so callbacks,
   * requests and mutations stay in one ordered stream and no barrier or early
   * flush is needed between them.
   */
  publish(
    ...args: {
      [T in PublishType]: [T, ...Parameters<ChannelEventHandlers[T]>]
    }[PublishType]
  ) {
    this.streamOps.push(...args)
    this.scheduler.schedule()
  }

  /**
   * Install the receiver of the peer's stream.
   *
   * The stream is a flat run of slots with no framing, so the decoder has to
   * know the arity of each opcode: `ARITY` provides it, and the switch below is
   * unrolled per arity. An operation with a new arity must be added here (the
   * `default` branch throws).
   */
  subscribeHandler(handler: SideHandlers<ReceiveType>) {
    this.subscribe(([ops, str, startsEpoch]) => {
      // strings are announced in arrival order, which keeps ids stable; a
      // payload that starts an epoch replaces the whole table instead, and
      // carries every string its ops refer to
      if (startsEpoch) this.recvStrings = str
      else this.recvStrings.push(...str)
      let start = 0
      while (start < ops.length) {
        const op = ops[start] as ReceiveType
        const handlerFn = handler[op] as (...args: any[]) => void
        switch (ARITY[op]) {
          case 0:
            handlerFn()
            start += 1
            break
          case 1:
            handlerFn(ops[start + 1])
            start += 2
            break
          case 2:
            handlerFn(ops[start + 1], ops[start + 2])
            start += 3
            break
          case 3:
            handlerFn(ops[start + 1], ops[start + 2], ops[start + 3])
            start += 4
            break
          case 4:
            handlerFn(ops[start + 1], ops[start + 2], ops[start + 3], ops[start + 4])
            start += 5
            break
          case 5:
            handlerFn(
              ops[start + 1],
              ops[start + 2],
              ops[start + 3],
              ops[start + 4],
              ops[start + 5],
            )
            start += 6
            break
          case 8:
            handlerFn(
              ops[start + 1],
              ops[start + 2],
              ops[start + 3],
              ops[start + 4],
              ops[start + 5],
              ops[start + 6],
              ops[start + 7],
              ops[start + 8],
            )
            start += 9
            break
          case 10:
            handlerFn(
              ops[start + 1],
              ops[start + 2],
              ops[start + 3],
              ops[start + 4],
              ops[start + 5],
              ops[start + 6],
              ops[start + 7],
              ops[start + 8],
              ops[start + 9],
              ops[start + 10],
            )
            start += 11
            break
          default:
            throw new Error(`unexpected channel event ${op as number}`)
        }
      }
    })
  }

  /**
   * Drop both string tables and the pending stream.
   *
   * Call this before replaying onto a fresh view side: the peer has not seen
   * any of the strings this channel already sent, so the next payload must
   * carry a table built from scratch (hence the epoch flag).
   */
  reset() {
    this.sendStringId = 0
    this.sendStringMap.clear()
    this.pendingStrings = []
    this.candidates.clear()
    this.pendingEpoch = true
    this.recvStrings = []
    this.streamOps = []
  }

  /**
   * Close the current epoch at a flush boundary.
   *
   * Called after the current payload's buffers are taken, so everything encoded
   * from here on (including re-entrant publishes from a synchronous transport)
   * belongs to the new table and travels in the flagged payload.
   */
  private beginEpoch() {
    this.sendStringId = 0
    this.sendStringMap.clear()
    this.pendingEpoch = true
  }
}
