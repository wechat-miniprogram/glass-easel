/* eslint-disable no-restricted-syntax */
import { tmpl, domBackend } from '../base/env'
import * as glassEasel from '../../src'

const componentSpace = new glassEasel.ComponentSpace()
componentSpace.updateComponentOptions({
  writeFieldsToNode: true,
})
componentSpace.defineComponent({
  is: '',
})

describe('Element Iterator', () => {
  it('should support iterating', () => {
    const Simple = componentSpace.defineComponent({})
    const Native = componentSpace.defineComponent({
      options: { externalComponent: true },
      template: tmpl('<div id="a"> <div id="b"><slot /></div> </div> <div id="c"></div>'),
    })
    const Full = componentSpace.defineComponent({
      using: { 'element-iterator-simple': Simple },
      template: tmpl(
        '<element-iterator-simple id="d"> <div id="e"><slot /></div> </element-iterator-simple> <div id="f"></div>',
      ),
    })
    const Combined = componentSpace.defineComponent({
      using: {
        'element-iterator-simple': Simple,
        'element-iterator-native': Native,
        'element-iterator-full': Full,
      },
      template: tmpl(
        '<element-iterator-full id="g"> <element-iterator-native id="h"> TEXT </element-iterator-native> <element-iterator-simple id="i"></element-iterator-simple> </element-iterator-full>',
      ),
    })
    const elem = glassEasel.Component.createWithContext(
      'element-iterator-combined',
      Combined,
      domBackend,
    )
    const g = elem.$.g as glassEasel.GeneralComponent
    const e = g.$.e as glassEasel.NativeNode
    const f = g.$.f as glassEasel.NativeNode
    const eslot = e.childNodes[0] as glassEasel.VirtualNode
    const d = g.$.d as glassEasel.GeneralComponent
    const dslot = (d.shadowRoot as glassEasel.ShadowRoot).childNodes[0] as glassEasel.VirtualNode
    const h = elem.$.h as glassEasel.GeneralComponent
    const i = elem.$.i as glassEasel.GeneralComponent
    const islot = (i.shadowRoot as glassEasel.ShadowRoot).childNodes[0] as glassEasel.VirtualNode
    const text = h.childNodes[0] as glassEasel.TextNode

    let expectResArr: any[] = [text, h, g, elem.shadowRoot]
    for (const node of glassEasel.ElementIterator.create(
      text,
      glassEasel.ElementIteratorType.ShadowAncestors,
      Object,
    )) {
      expect(node).toBe(expectResArr.shift())
    }
    expect(expectResArr.length).toBe(0)

    expectResArr = [
      text,
      h,
      eslot,
      e,
      dslot,
      d.shadowRoot,
      d,
      g.shadowRoot,
      g,
      elem.shadowRoot,
      elem,
    ]
    for (const node of glassEasel.ElementIterator.create(
      text,
      glassEasel.ElementIteratorType.ComposedAncestors,
      Object,
    )) {
      expect(node).toBe(expectResArr.shift())
    }
    expect(expectResArr.length).toBe(0)

    expectResArr = [text, h, eslot]
    for (const node of glassEasel.ElementIterator.create(
      text,
      glassEasel.ElementIteratorType.ComposedAncestors,
      Object,
    )) {
      if (node === e) break
      expect(node).toBe(expectResArr.shift())
    }
    expect(expectResArr.length).toBe(0)

    expectResArr = [elem.shadowRoot, g, h, i]
    for (const node of glassEasel.ElementIterator.create(
      elem.shadowRoot as glassEasel.ShadowRoot,
      glassEasel.ElementIteratorType.ShadowDescendantsRootFirst,
    )) {
      expect(node).toBe(expectResArr.shift())
    }
    expect(expectResArr.length).toBe(0)

    expectResArr = [h, i, g]
    for (const node of glassEasel.ElementIterator.create(
      elem.shadowRoot as glassEasel.ShadowRoot,
      glassEasel.ElementIteratorType.ShadowDescendantsRootLast,
      glassEasel.Component,
    )) {
      expect(node).toBe(expectResArr.shift())
    }
    expect(expectResArr.length).toBe(0)

    expectResArr = [g]
    for (const node of glassEasel.ElementIterator.create(
      g,
      glassEasel.ElementIteratorType.ShadowDescendantsRootFirst,
      Object,
    )) {
      if (node === h) break
      expect(node).toBe(expectResArr.shift())
    }
    expect(expectResArr.length).toBe(0)

    expectResArr = [h]
    for (const node of glassEasel.ElementIterator.create(
      g,
      glassEasel.ElementIteratorType.ShadowDescendantsRootLast,
      glassEasel.Component,
    )) {
      if (node === i) break
      expect(node).toBe(expectResArr.shift())
    }
    expect(expectResArr.length).toBe(0)

    expectResArr = [
      g,
      g.shadowRoot,
      d,
      d.shadowRoot,
      dslot,
      e,
      eslot,
      h,
      text,
      i,
      i.shadowRoot,
      islot,
      f,
    ]
    for (const node of glassEasel.ElementIterator.create(
      g,
      glassEasel.ElementIteratorType.ComposedDescendantsRootFirst,
      Object,
    )) {
      expect(node).toBe(expectResArr.shift())
    }
    expect(expectResArr.length).toBe(0)
    expectResArr = [e, eslot, h, text, i, i.shadowRoot, islot]
    for (const node of glassEasel.ElementIterator.create(
      e,
      glassEasel.ElementIteratorType.ComposedDescendantsRootFirst,
      Object,
    )) {
      expect(node).toBe(expectResArr.shift())
    }
    expect(expectResArr.length).toBe(0)

    expectResArr = [h, i, d, g]
    for (const node of glassEasel.ElementIterator.create(
      g,
      glassEasel.ElementIteratorType.ComposedDescendantsRootLast,
      glassEasel.Component,
    )) {
      expect(node).toBe(expectResArr.shift())
    }
    expect(expectResArr.length).toBe(0)

    expectResArr = [g, g.shadowRoot]
    for (const node of glassEasel.ElementIterator.create(
      g,
      glassEasel.ElementIteratorType.ComposedDescendantsRootFirst,
      Object,
    )) {
      if (node === d) break
      expect(node).toBe(expectResArr.shift())
    }
    expect(expectResArr.length).toBe(0)

    expectResArr = [h, i]
    for (const node of glassEasel.ElementIterator.create(
      g,
      glassEasel.ElementIteratorType.ComposedDescendantsRootLast,
      glassEasel.Component,
    )) {
      if (node === d) break
      expect(node).toBe(expectResArr.shift())
    }
    expect(expectResArr.length).toBe(0)

    expectResArr = [elem.shadowRoot, g, i]
    let iterator = glassEasel.ElementIterator.create(
      elem.shadowRoot as glassEasel.ShadowRoot,
      glassEasel.ElementIteratorType.ShadowDescendantsRootFirst,
      Object,
    )[Symbol.iterator]()
    for (let it = iterator.next(); !it.done; ) {
      const node = it.value
      if (node === h) {
        it = iterator.next(false)
        continue
      }
      expect(node).toBe(expectResArr.shift())
      it = iterator.next()
    }
    expect(expectResArr.length).toBe(0)

    expectResArr = [g, g.shadowRoot, d, f]
    iterator = glassEasel.ElementIterator.create(
      g,
      glassEasel.ElementIteratorType.ComposedDescendantsRootFirst,
      Object,
    )[Symbol.iterator]()
    for (let it = iterator.next(); !it.done; ) {
      const node = it.value
      expect(node).toBe(expectResArr.shift())
      if (node === d) {
        it = iterator.next(false)
        continue
      }
      it = iterator.next()
    }
    expect(expectResArr.length).toBe(0)
  })
})
