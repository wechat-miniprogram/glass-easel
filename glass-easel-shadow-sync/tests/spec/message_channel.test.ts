import { ChannelEventType } from '../../src/channel_protocol'
import type {
  ChannelEventTypeDataSide,
  ChannelEventTypeViewSide,
  StringRef,
} from '../../src/channel_protocol'
import { MessageChannelDataSide } from '../../src/message_channel'
import { getLinearIdGenerator } from '../../src/utils'
import type { TransportBridge } from '../../src/transport_bridge'

/** Record what the channel publishes while pretending every string is interned. */
const createDataChannel = () => {
  const encoded: string[] = []
  const published: unknown[][] = []
  const bridge = {
    encodeString(str: string) {
      encoded.push(str)
      return `ref:${str}` as unknown as StringRef
    },
    decodeString(ref: StringRef) {
      return String(ref)
    },
    publish(...args: unknown[]) {
      published.push(args)
    },
    subscribeHandler() {
      /* nothing to receive */
    },
    reset() {
      /* nothing to reset */
    },
  } as unknown as TransportBridge<ChannelEventTypeDataSide, ChannelEventTypeViewSide>
  return { channel: MessageChannelDataSide(bridge, getLinearIdGenerator), encoded, published }
}

describe('channel operations', () => {
  test('ASSOCIATE_VALUE payload goes through the string table', () => {
    const { channel, encoded, published } = createDataChannel()
    channel.associateValue(1, { isReflect: false })
    // the payload is shortened like every other string argument: it repeats for
    // almost every component, so the transport only ships it once
    expect(encoded).toEqual(['{"isReflect":false}'])
    expect(published).toEqual([[ChannelEventType.ASSOCIATE_VALUE, 1, 'ref:{"isReflect":false}']])
  })
})
