/*
 * Transport layer of a shadow-sync channel.
 *
 * `MessageChannelDataSide` / `MessageChannelViewSide` (see `message_channel.ts`)
 * turn glass-easel backend calls into typed `publish(OP, ...args)` calls; this
 * module owns what actually goes on the wire. It packs the arguments of every
 * operation into one flat op stream, interns the strings in it, and hands the
 * result to a plain `[ops, strings]` transport (the demo `Bridge`, the worker
 * channel, the synchronous test bridge, ...).
 *
 * Both directions use the same encoding, so a bridge is full duplex: `publish`
 * encodes, `subscribeHandler` decodes. A transport never sees a
 * `ChannelEventType`, only numbers and JSON-safe values.
 */
import { ARITY } from './channel_protocol'
import type { ChannelEventHandlers, ChannelEventType, StringRef } from './channel_protocol'

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

/**
 * Encodes outgoing operations into a compact stream and replays incoming ones.
 *
 * Outgoing operations (`publish`) are appended to `streamOps` as
 * `[op, arg, arg, ...]` slots and flushed as a single `[ops, newStrings]`
 * payload per scheduled flush, so one message carries a whole batch of DOM
 * operations instead of one message per operation.
 *
 * String arguments are interned per channel and replaced by a negative
 * reference (`-1 - id`): the first occurrence ships the string in
 * `pendingStrings`, every later occurrence ships only the reference. Negative
 * numbers can never collide with node / callback ids. The peer keeps its own
 * table (`recvStrings`) in arrival order.
 *
 * The two directions have independent tables, and `reset` clears both.
 */
export class StreamTransportBridge<
  PublishType extends ChannelEventType,
  ReceiveType extends ChannelEventType,
> implements TransportBridge<PublishType, ReceiveType>
{
  // outgoing direction: the string table grows with every distinct string sent
  private sendStringId = 0
  private sendStringMap = new Map<string, number>()
  private pendingStrings: string[] = []
  // incoming direction: strings announced by the peer, indexed by interned id
  private recvStrings: string[] = []
  // pending `[op, ...args]` slots, flushed as one payload
  private streamOps: unknown[] = []

  constructor(
    publish: (arg: [unknown[], string[]]) => void,
    private subscribe: (handler: (arg: [unknown[], string[]]) => void) => void,
    private scheduler: Scheduler,
  ) {
    scheduler.onFlush(() => {
      const ops = this.streamOps
      const str = this.pendingStrings
      // take the buffers before publishing: a synchronous transport may deliver
      // the payload (and publish more operations) before `publish` returns
      this.streamOps = []
      this.pendingStrings = []
      publish([ops, str])
    })
  }

  /**
   * Intern a string and return its reference.
   *
   * New strings are shipped in the header of the next payload; repeated ones
   * cost a single negative number.
   */
  encodeString(s: string): StringRef {
    let id = this.sendStringMap.get(s)
    if (id === undefined) {
      id = this.sendStringId
      this.sendStringId += 1
      this.pendingStrings.push(s)
      this.sendStringMap.set(s, id)
    }
    return (-1 - id) as StringRef
  }

  /** Resolve a reference against the table announced by the peer. */
  decodeString(id: StringRef): string {
    return this.recvStrings[-1 - id]!
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
    this.subscribe(([ops, str]) => {
      // strings are announced in arrival order: appending keeps ids stable
      this.recvStrings.push(...str)
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
   * carry a table built from scratch.
   */
  reset() {
    this.sendStringId = 0
    this.sendStringMap.clear()
    this.pendingStrings = []
    this.recvStrings = []
    this.streamOps = []
  }
}
