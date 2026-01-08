/* globals document */

import { tmpl, domBackend } from '../base/env'
import * as glassEasel from '../../src'

const componentSpace = new glassEasel.ComponentSpace()
componentSpace.updateComponentOptions({
  writeFieldsToNode: true,
  writeIdToDOM: true,
})
componentSpace.defineComponent({
  is: '',
})

describe('domlike backend', () => {
  beforeAll(() => {
    domBackend.onEvent(glassEasel.Event.triggerBackendEvent)
  })

  describe('events', () => {
    it('tap event', () => {
      const ops: number[] = []
      let touch: Touch

      const Comp = componentSpace
        .define()
        .template(
          tmpl(`
          <div
            bind:tap="onTapWrapper"
            bind:touchstart="onTouchStartWrapper"
          >
            <span
              id="button"
              bind:tap="onTapButton"
              bind:touchstart="onTouchStartButton"
            ></span>
          </div>
        `),
        )
        .init(({ listener }) => {
          const onTapWrapper = listener<{ x: number; y: number }>((e) => {
            ops.push(1)
            expect(e.bubbles).toBe(true)
            expect(e.detail).toEqual({ x: -1, y: -1 })
          })

          const onTapButton = listener<{ x: number; y: number }>((e) => {
            ops.push(2)
            expect(e.bubbles).toBe(true)
            expect(e.detail).toEqual({ x: -1, y: -1 })
          })

          const onTouchStartWrapper = listener((e) => {
            ops.push(3)
            expect(e.bubbles).toBe(true)
            expect(e.detail).toEqual({
              altKey: false,
              changedTouches: [touch],
              ctrlKey: false,
              isTrusted: false,
              metaKey: false,
              shiftKey: false,
              targetTouches: [],
              touches: [touch],
            })
          })

          const onTouchStartButton = listener((e) => {
            ops.push(4)
            expect(e.bubbles).toBe(true)
            expect(e.detail).toEqual({
              altKey: false,
              changedTouches: [touch],
              ctrlKey: false,
              isTrusted: false,
              metaKey: false,
              shiftKey: false,
              targetTouches: [],
              touches: [touch],
            })
          })

          return {
            onTapWrapper,
            onTapButton,
            onTouchStartWrapper,
            onTouchStartButton,
          }
        })
        .registerComponent()

      const comp = glassEasel.Component.createWithContext('root', Comp, domBackend)
      const placeholder = document.createElement('span')
      document.body.appendChild(placeholder)
      glassEasel.Element.replaceDocumentElement(
        comp,
        document.body as any as glassEasel.GeneralBackendElement,
        placeholder as any as glassEasel.GeneralBackendElement,
      )

      const button = (comp.$.button as glassEasel.Element).$$ as any as HTMLSpanElement

      touch = {
        identifier: 0,
        clientX: -1,
        clientY: -1,
        pageX: -1,
        pageY: -1,
        screenX: -1,
        screenY: -1,
        force: 1,
        radiusX: 1,
        radiusY: 1,
        rotationAngle: 0,
        target: button,
      }

      const touchstart = new TouchEvent('touchstart', {
        touches: [touch],
        changedTouches: [touch],
        bubbles: true,
        composed: true,
      })
      button.dispatchEvent(touchstart)
      const touchend = new TouchEvent('touchend', {
        touches: [],
        changedTouches: [touch],
        bubbles: true,
        composed: true,
      })
      button.dispatchEvent(touchend)
      expect(ops).toEqual([4, 3, 2, 1])
    })
    it('non-delegate event', () => {
      const ops: number[] = []

      const Comp = componentSpace
        .define()
        .template(
          tmpl(`
          <div
            bind:keydown="onKeydownWrapper"
          >
            <span
              id="button"
              bind:keydown="onKeydownButton"
            ></span>
          </div>
        `),
        )
        .init(({ listener }) => {
          const onKeydownWrapper = listener((e) => {
            ops.push(5)
            expect(e.bubbles).toBe(true)
          })

          const onKeydownButton = listener((e) => {
            ops.push(6)
            expect(e.bubbles).toBe(true)
          })

          return {
            onKeydownWrapper,
            onKeydownButton,
          }
        })
        .registerComponent()

      const comp = glassEasel.Component.createWithContext('root', Comp, domBackend)
      const placeholder = document.createElement('span')
      document.body.appendChild(placeholder)
      glassEasel.Element.replaceDocumentElement(
        comp,
        document.body as any as glassEasel.GeneralBackendElement,
        placeholder as any as glassEasel.GeneralBackendElement,
      )

      const button = (comp.$.button as glassEasel.Element).$$ as any as HTMLSpanElement

      const keydown = new Event('keydown', {
        bubbles: true,
        composed: true,
      })
      button.dispatchEvent(keydown)
      expect(ops).toEqual([6, 5])
    })
    it('non-bubble event', () => {
      const ops: number[] = []

      const Comp = componentSpace
        .define()
        .template(
          tmpl(`
          <div
            bind:focus="onFocusWrapper"
          >
            <span
              id="button"
              bind:focus="onFocusButton"
            ></span>
          </div>
        `),
        )
        .init(({ listener }) => {
          const onFocusWrapper = listener((e) => {
            ops.push(5)
            expect(e.bubbles).toBe(false)
          })

          const onFocusButton = listener((e) => {
            ops.push(6)
            expect(e.bubbles).toBe(false)
          })

          return {
            onFocusWrapper,
            onFocusButton,
          }
        })
        .registerComponent()

      const comp = glassEasel.Component.createWithContext('root', Comp, domBackend)
      const placeholder = document.createElement('span')
      document.body.appendChild(placeholder)
      glassEasel.Element.replaceDocumentElement(
        comp,
        document.body as any as glassEasel.GeneralBackendElement,
        placeholder as any as glassEasel.GeneralBackendElement,
      )

      const button = (comp.$.button as glassEasel.Element).$$ as any as HTMLSpanElement

      const focus = new Event('focus', {
        bubbles: false,
        composed: false,
      })
      button.dispatchEvent(focus)
      expect(ops).toEqual([6])
    })
    it('native-rendering event', () => {
      let ops: number[] = []

      const Native = componentSpace
        .define()
        .options({
          externalComponent: true,
        })
        .template(
          tmpl(`
          <div id="div" bind:click="onClick"><slot /></div>
        `),
        )
        .init(({ listener }) => {
          const onClick = listener(() => {
            ops.push(1)
          })

          return {
            onClick,
          }
        })
        .registerComponent()

      const Comp = componentSpace
        .define()
        .template(
          tmpl(`
          <div bind:click="onClick"><slot /></div>
        `),
        )
        .init(({ listener }) => {
          const onClick = listener(() => {
            ops.push(2)
          })

          return {
            onClick,
          }
        })
        .registerComponent()

      const Root = componentSpace
        .define()
        .usingComponents({
          native: Native,
          comp: Comp,
        })
        .template(
          tmpl(`
          <comp bind:click="onClick">
            <native id="native">
              <button id="button">Click</button>
            </native>
          </comp>
        `),
        )
        .init(({ listener }) => {
          const onClick = listener(() => {
            ops.push(3)
          })

          return {
            onClick,
          }
        })
        .registerComponent()

      const comp = glassEasel.Component.createWithContext('root', Root, domBackend)
      const placeholder = document.createElement('span')
      document.body.appendChild(placeholder)
      glassEasel.Element.replaceDocumentElement(
        comp,
        document.body as any as glassEasel.GeneralBackendElement,
        placeholder as any as glassEasel.GeneralBackendElement,
      )

      const button = (comp.$.button as glassEasel.Element).$$ as any as HTMLButtonElement
      const native = (comp.$.native as glassEasel.GeneralComponent).$$ as any as HTMLElement
      const nativeDiv = (comp.$.native as glassEasel.GeneralComponent).$.div as any as HTMLElement

      const click = new MouseEvent('click', {
        bubbles: true,
        composed: true,
      })
      button.dispatchEvent(click)
      expect(ops).toEqual([1, 2, 3])

      ops = []
      nativeDiv.dispatchEvent(click)
      expect(ops).toEqual([1, 2, 3])

      ops = []
      native.dispatchEvent(click)
      expect(ops).toEqual([2, 3])
    })
  })

  describe('render', () => {
    it('render should work', async () => {
      let renderCallback = false
      await new Promise<void>((resolve) => {
        domBackend.render(() => {
          renderCallback = true
          resolve()
        })
      })
      expect(renderCallback).toBe(true)
    })
  })
})
