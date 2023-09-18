import { tmpl, domBackend, composedBackend } from '../base/env'
import { virtual as matchElementWithDom } from '../base/match'
import * as glassEasel from '../../src'

const domHtml = (elem: glassEasel.Element): string => {
  const domElem = elem.getBackendElement() as unknown as Element
  return domElem.innerHTML
}

const testCases = (testBackend: glassEasel.GeneralBackendContext) => {
const componentSpace = new glassEasel.ComponentSpace()
componentSpace.updateComponentOptions({
  writeFieldsToNode: true,
  writeIdToDOM: true,
})
componentSpace.defineComponent({
  is: '',
})

  describe('dynamic slot', () => {
    describe('core', () => {
      test('should support duplicate slot', () => {
        const ops: Array<[number, string]> = []

        const comp = componentSpace
          .define()
          .property('s', String)
          .lifetime('attached', function () {
            ops.push([-1, this.data.s.toString()])
          })
          .lifetime('detached', function () {
            ops.push([-2, this.data.s.toString()])
          })
          .lifetime('moved', function () {
            ops.push([-3, this.data.s.toString()])
          })
          .registerComponent()

        const child = componentSpace
          .define()
          .options({ dynamicSlots: true })
          .definition({
            template: tmpl('<span id="a"></span>'),
          })
          .registerComponent()

        const parent = componentSpace
          .define()
          .usingComponents({ child, comp })
          .definition({
            template: tmpl(`
              <child>
                <comp slot="a" s="A">A</comp>
                <comp slot="b" s="B">B</comp>
                <comp slot="c" s="C">C</comp>
                <comp s="D">D</comp>
              </child>
            `),
          })
          .registerComponent()

        const parentElem = glassEasel.Component.createWithContext(
          'root',
          parent.general(),
          testBackend,
        )
        const childElem = parentElem.getShadowRoot()!.childNodes[0]!.asInstanceOf(child)!
        const a = childElem.$.a as glassEasel.Element

        const slot1 = childElem.getShadowRoot()!.createVirtualNode('slot')
        glassEasel.Element.setSlotName(slot1, '')

        const slotA1 = childElem.getShadowRoot()!.createVirtualNode('slot')
        glassEasel.Element.setSlotName(slotA1, 'a')

        const slotA2 = childElem.getShadowRoot()!.createVirtualNode('slot')
        glassEasel.Element.setSlotName(slotA2, 'a')

        const slotB = childElem.getShadowRoot()!.createVirtualNode('slot')
        glassEasel.Element.setSlotName(slotB, 'b')

        glassEasel.Element.pretendAttached(parentElem)
        expect(childElem.childNodes.length).toBe(0)
        expect(ops).toEqual([])
        expect(domHtml(parentElem)).toBe('<child><span id="a"></span></child>')
        matchElementWithDom(parentElem)

        a.appendChild(slotA1)
        expect(childElem.childNodes.length).toBe(4)
        expect(slotA1.getComposedChildren()).toEqual(childElem.childNodes)
        expect(domHtml(parentElem)).toBe('<child><span id="a"><comp>A</comp></span></child>')
        expect(ops).toEqual([[-1, 'A']])
        matchElementWithDom(parentElem)

        a.appendChild(slotA2)
        expect(childElem.childNodes.length).toBe(8)
        expect(slotA1.getComposedChildren()).toEqual(childElem.childNodes.slice(0, 4))
        expect(slotA2.getComposedChildren()).toEqual(childElem.childNodes.slice(4, 8))
        expect(domHtml(parentElem)).toBe(
          '<child><span id="a"><comp>A</comp><comp>A</comp></span></child>',
        )
        expect(ops).toEqual([
          [-1, 'A'],
          [-1, 'A'],
        ])
        matchElementWithDom(parentElem)

        a.insertBefore(slotB, slotA2)
        expect(childElem.childNodes.length).toBe(12)
        expect(slotA1.getComposedChildren()).toEqual(childElem.childNodes.slice(0, 4))
        expect(slotA2.getComposedChildren()).toEqual(childElem.childNodes.slice(4, 8))
        expect(slotB.getComposedChildren()).toEqual(childElem.childNodes.slice(8, 12))
        expect(domHtml(parentElem)).toBe(
          '<child><span id="a"><comp>A</comp><comp>B</comp><comp>A</comp></span></child>',
        )
        expect(ops).toEqual([
          [-1, 'A'],
          [-1, 'A'],
          [-1, 'B'],
        ])
        matchElementWithDom(parentElem)

        a.removeChild(slotA1)
        expect(childElem.childNodes.length).toBe(8)
        expect(slotA2.getComposedChildren()).toEqual(childElem.childNodes.slice(0, 4))
        expect(slotB.getComposedChildren()).toEqual(childElem.childNodes.slice(4, 8))
        expect(domHtml(parentElem)).toBe(
          '<child><span id="a"><comp>B</comp><comp>A</comp></span></child>',
        )
        expect(ops).toEqual([
          [-1, 'A'],
          [-1, 'A'],
          [-1, 'B'],
          [-2, 'A'],
        ])
        matchElementWithDom(parentElem)

        a.appendChild(slotA1)
        expect(childElem.childNodes.length).toBe(12)
        expect(slotA2.getComposedChildren()).toEqual(childElem.childNodes.slice(0, 4))
        expect(slotB.getComposedChildren()).toEqual(childElem.childNodes.slice(4, 8))
        expect(slotA1.getComposedChildren()).toEqual(childElem.childNodes.slice(8, 12))
        expect(domHtml(parentElem)).toBe(
          '<child><span id="a"><comp>B</comp><comp>A</comp><comp>A</comp></span></child>',
        )
        expect(ops).toEqual([
          [-1, 'A'],
          [-1, 'A'],
          [-1, 'B'],
          [-2, 'A'],
          [-1, 'A'],
        ])
        matchElementWithDom(parentElem)

        a.appendChild(slot1)
        expect(childElem.childNodes.length).toBe(16)
        expect(slotA2.getComposedChildren()).toEqual(childElem.childNodes.slice(0, 4))
        expect(slotB.getComposedChildren()).toEqual(childElem.childNodes.slice(4, 8))
        expect(slotA1.getComposedChildren()).toEqual(childElem.childNodes.slice(8, 12))
        expect(slot1.getComposedChildren()).toEqual(childElem.childNodes.slice(12, 16))
        expect(domHtml(parentElem)).toBe(
          '<child><span id="a"><comp>B</comp><comp>A</comp><comp>A</comp><comp>D</comp></span></child>',
        )
        expect(ops).toEqual([
          [-1, 'A'],
          [-1, 'A'],
          [-1, 'B'],
          [-2, 'A'],
          [-1, 'A'],
          [-1, 'D'],
        ])
        matchElementWithDom(parentElem)
      })

      test('should support slot element modification', () => {
        const child = componentSpace
          .define()
          .options({ dynamicSlots: true })
          .definition({
            template: tmpl('<slot name="a" /> <span><slot name="b" /></span> <slot name="a" />'),
          })
          .registerComponent()

        const parent = componentSpace
          .define()
          .usingComponents({ child })
          .definition({
            template: tmpl('<child></child>'),
          })
          .registerComponent()

        const parentElem = glassEasel.Component.createWithContext(
          'root',
          parent.general(),
          testBackend,
        )
        const childElem = parentElem.getShadowRoot()!.childNodes[0]!.asInstanceOf(child)!

        const slotA = childElem.getShadowRoot()!.childNodes[0]! as glassEasel.Element
        const slotB = (childElem.getShadowRoot()!.childNodes[1]! as glassEasel.Element)
          .childNodes[0]! as glassEasel.Element
        const slotC = childElem.getShadowRoot()!.childNodes[2]! as glassEasel.Element

        const contentA = parentElem.getShadowRoot()!.createVirtualNode('virtual')
        contentA.appendChild(parentElem.getShadowRoot()!.createTextNode('A'))

        const contentB = parentElem.getShadowRoot()!.createVirtualNode('virtual')
        glassEasel.Element.setInheritSlots(contentB)
        const textB = parentElem.getShadowRoot()!.createTextNode('B')
        contentB.appendChild(textB)

        glassEasel.Element.pretendAttached(parentElem)
        expect(slotA.getComposedChildren()).toEqual([])
        expect(slotB.getComposedChildren()).toEqual([])
        expect(slotC.getComposedChildren()).toEqual([])
        expect(domHtml(parentElem)).toBe('<child><span></span></child>')
        matchElementWithDom(parentElem)

        childElem.appendChild(contentA)
        expect(contentA.getComposedParent()).toBe(null)
        expect(slotA.getComposedChildren()).toEqual([])
        expect(slotB.getComposedChildren()).toEqual([])
        expect(slotC.getComposedChildren()).toEqual([])
        expect(domHtml(parentElem)).toBe('<child><span></span></child>')
        matchElementWithDom(parentElem)

        glassEasel.Element.setSlotElement(contentA, slotA)
        expect(contentA.getComposedParent()).toBe(slotA)
        expect(slotA.getComposedChildren()).toEqual([contentA])
        expect(slotB.getComposedChildren()).toEqual([])
        expect(slotC.getComposedChildren()).toEqual([])
        expect(domHtml(parentElem)).toBe('<child>A<span></span></child>')
        matchElementWithDom(parentElem)

        glassEasel.Element.setSlotElement(contentA, slotB)
        expect(contentA.getComposedParent()).toBe(slotB)
        expect(slotA.getComposedChildren()).toEqual([])
        expect(slotB.getComposedChildren()).toEqual([contentA])
        expect(slotC.getComposedChildren()).toEqual([])
        expect(domHtml(parentElem)).toBe('<child><span>A</span></child>')
        matchElementWithDom(parentElem)

        childElem.removeChild(contentA)
        expect(contentA.getComposedParent()).toBe(null)
        expect(slotA.getComposedChildren()).toEqual([])
        expect(slotB.getComposedChildren()).toEqual([])
        expect(slotC.getComposedChildren()).toEqual([])
        expect(domHtml(parentElem)).toBe('<child><span></span></child>')
        matchElementWithDom(parentElem)

        glassEasel.Element.setSlotElement(contentA, slotC)
        childElem.appendChild(contentA)
        expect(contentA.getComposedParent()).toBe(slotC)
        expect(slotA.getComposedChildren()).toEqual([])
        expect(slotB.getComposedChildren()).toEqual([])
        expect(slotC.getComposedChildren()).toEqual([contentA])
        expect(domHtml(parentElem)).toBe('<child><span></span>A</child>')
        matchElementWithDom(parentElem)

        childElem.appendChild(contentB)
        expect(contentA.getComposedParent()).toBe(slotC)
        expect(contentB.getComposedParent()).toBe(null)
        expect(textB.getComposedParent()).toBe(null)
        expect(slotA.getComposedChildren()).toEqual([])
        expect(slotB.getComposedChildren()).toEqual([])
        expect(slotC.getComposedChildren()).toEqual([contentA])
        expect(domHtml(parentElem)).toBe('<child><span></span>A</child>')
        matchElementWithDom(parentElem)

        glassEasel.Element.setSlotElement(contentB, slotC)
        expect(contentA.getComposedParent()).toBe(slotC)
        expect(contentB.getComposedParent()).toBe(slotC)
        expect(textB.getComposedParent()).toBe(slotC)
        expect(slotA.getComposedChildren()).toEqual([])
        expect(slotB.getComposedChildren()).toEqual([])
        expect(slotC.getComposedChildren()).toEqual([contentA, contentB, textB])
        expect(domHtml(parentElem)).toBe('<child><span></span>AB</child>')
        matchElementWithDom(parentElem)

        childElem.appendChild(contentA)
        expect(contentA.getComposedParent()).toBe(slotC)
        expect(contentB.getComposedParent()).toBe(slotC)
        expect(textB.getComposedParent()).toBe(slotC)
        expect(slotA.getComposedChildren()).toEqual([])
        expect(slotB.getComposedChildren()).toEqual([])
        expect(slotC.getComposedChildren()).toEqual([contentB, textB, contentA])
        expect(domHtml(parentElem)).toBe('<child><span></span>BA</child>')
        matchElementWithDom(parentElem)

        glassEasel.Element.setSlotElement(contentB, slotB)
        expect(contentA.getComposedParent()).toBe(slotC)
        expect(contentB.getComposedParent()).toBe(slotB)
        expect(textB.getComposedParent()).toBe(slotB)
        expect(slotA.getComposedChildren()).toEqual([])
        expect(slotB.getComposedChildren()).toEqual([contentB, textB])
        expect(slotC.getComposedChildren()).toEqual([contentA])
        expect(domHtml(parentElem)).toBe('<child><span>B</span>A</child>')
        matchElementWithDom(parentElem)

        childElem.removeChild(contentB)
        expect(contentA.getComposedParent()).toBe(slotC)
        expect(contentB.getComposedParent()).toBe(null)
        expect(textB.getComposedParent()).toBe(null)
        expect(slotA.getComposedChildren()).toEqual([])
        expect(slotB.getComposedChildren()).toEqual([])
        expect(slotC.getComposedChildren()).toEqual([contentA])
        expect(domHtml(parentElem)).toBe('<child><span></span>A</child>')
        matchElementWithDom(parentElem)

        glassEasel.Element.setSlotElement(contentB, slotA)
        childElem.appendChild(contentB)
        expect(contentA.getComposedParent()).toBe(slotC)
        expect(contentB.getComposedParent()).toBe(slotA)
        expect(textB.getComposedParent()).toBe(slotA)
        expect(slotA.getComposedChildren()).toEqual([contentB, textB])
        expect(slotB.getComposedChildren()).toEqual([])
        expect(slotC.getComposedChildren()).toEqual([contentA])
        expect(domHtml(parentElem)).toBe('<child>B<span></span>A</child>')
        matchElementWithDom(parentElem)

        childElem.removeChild(contentA)
        expect(contentA.getComposedParent()).toBe(null)
        expect(contentB.getComposedParent()).toBe(slotA)
        expect(textB.getComposedParent()).toBe(slotA)
        expect(slotA.getComposedChildren()).toEqual([contentB, textB])
        expect(slotB.getComposedChildren()).toEqual([])
        expect(slotC.getComposedChildren()).toEqual([])
        expect(domHtml(parentElem)).toBe('<child>B<span></span></child>')
        matchElementWithDom(parentElem)

        childElem.removeChild(contentB)
        expect(contentA.getComposedParent()).toBe(null)
        expect(contentB.getComposedParent()).toBe(null)
        expect(textB.getComposedParent()).toBe(null)
        expect(slotA.getComposedChildren()).toEqual([])
        expect(slotB.getComposedChildren()).toEqual([])
        expect(slotC.getComposedChildren()).toEqual([])
        expect(domHtml(parentElem)).toBe('<child><span></span></child>')
        matchElementWithDom(parentElem)
      })
    })

    describe('tmpl', () => {
      test('should support slot content modification', () => {
        const child = componentSpace
          .define()
          .options({ dynamicSlots: true })
          .definition({
            template: tmpl(`
              <slot name="a" />
              <span>
                <slot name="a" />
              </span>
              <slot name="a" />
            `),
          })
          .registerComponent()

        const parent = componentSpace
          .define()
          .usingComponents({ child })
          .data(() => ({
            slotName1: 'a',
            slotContent1: 'A',
            slotName2: 'a',
            slotContent2: 'B',
          }))
          .definition({
            template: tmpl(`
              <child>
                <block slot="{{slotName1}}">{{slotContent1}}</block>
                <block slot="{{slotName2}}">{{slotContent2}}</block>
              </child>
            `),
          })
          .registerComponent()

        const parentElem = glassEasel.Component.createWithContext(
          'root',
          parent.general(),
          testBackend,
        )
        const childElem = parentElem.getShadowRoot()!.childNodes[0]!.asInstanceOf(child)!

        expect(childElem.childNodes.length).toBe(6)
        expect(domHtml(parentElem)).toBe('<child>AB<span>AB</span>AB</child>')
        matchElementWithDom(parentElem)

        parentElem.setData({ slotContent1: 'AA' })
        expect(childElem.childNodes.length).toBe(6)
        expect(domHtml(parentElem)).toBe('<child>AAB<span>AAB</span>AAB</child>')
        matchElementWithDom(parentElem)

        parentElem.setData({ slotName1: 'b' })
        expect(childElem.childNodes.length).toBe(6)
        expect(domHtml(parentElem)).toBe('<child>B<span>B</span>B</child>')
        matchElementWithDom(parentElem)

        parentElem.setData({ slotContent1: 'C', slotName1: 'a' })
        expect(childElem.childNodes.length).toBe(6)
        expect(domHtml(parentElem)).toBe('<child>CB<span>CB</span>CB</child>')
        matchElementWithDom(parentElem)

        parentElem.setData({ slotContent2: 'D' })
        expect(childElem.childNodes.length).toBe(6)
        expect(domHtml(parentElem)).toBe('<child>CD<span>CD</span>CD</child>')
        matchElementWithDom(parentElem)

        parentElem.setData({ slotName2: 'c' })
        expect(childElem.childNodes.length).toBe(6)
        expect(domHtml(parentElem)).toBe('<child>C<span>C</span>C</child>')
        matchElementWithDom(parentElem)

        parentElem.setData({ slotName1: 'b', slotName2: 'c' })
        expect(childElem.childNodes.length).toBe(6)
        expect(domHtml(parentElem)).toBe('<child><span></span></child>')
        matchElementWithDom(parentElem)
      })

      test('should support slot name modification', () => {
        const child = componentSpace
          .define()
          .options({ dynamicSlots: true })
          .definition({
            template: tmpl(`
              <slot name="{{sn}}" some-text="123" />
            `),
          })
          .data(() => ({
            sn: 'abc',
          }))
          .registerComponent()

        const parent = componentSpace
          .define()
          .usingComponents({ child })
          .definition({
            template: tmpl(`
              <child>
                <span>456</span>
                <div slot="abc" slot:some-text>{{someText}}</div>
              </child>
            `),
          })
          .registerComponent()

        const parentElem = glassEasel.Component.createWithContext(
          'root',
          parent.general(),
          testBackend,
        )
        const childElem = parentElem.getShadowRoot()!.childNodes[0]!.asInstanceOf(child)!

        expect(domHtml(parentElem)).toBe('<child><div>123</div></child>')
        matchElementWithDom(parentElem)

        childElem.setData({ sn: '' })
        expect(domHtml(parentElem)).toBe('<child><span>456</span></child>')
        matchElementWithDom(parentElem)

        childElem.setData({ sn: 'def' })
        expect(domHtml(parentElem)).toBe('<child></child>')
        matchElementWithDom(parentElem)

        childElem.setData({ sn: 'abc' })
        expect(domHtml(parentElem)).toBe('<child><div>123</div></child>')
        matchElementWithDom(parentElem)
      })

      test('nested inside dynamic slots', () => {
        let ops: Array<[number, string]> = []

        const x = componentSpace
          .define()
          .property('s', String)
          .lifetime('attached', function () {
            ops.push([-1, this.data.s.toString()])
          })
          .lifetime('detached', function () {
            ops.push([-2, this.data.s.toString()])
          })
          .lifetime('moved', function () {
            ops.push([-3, this.data.s.toString()])
          })
          .registerComponent()

        const c1 = componentSpace
          .define()
          .property('enableA1', Boolean)
          .property('enableA2', Boolean)
          .definition({
            template: tmpl(
              `
                <slot wx:if="{{enableA1}}" name="a1" />
                <a><slot wx:if="{{enableA2}}" name="a2"/></a>
              `,
            ),
          })
          .registerComponent()

        const c2 = componentSpace
          .define()
          .options({ multipleSlots: true })
          .property('enableA1', Boolean)
          .property('enableA2', Boolean)
          .definition({
            template: tmpl(
              `
                <slot wx:if="{{enableA1}}" name="a1" />
                <a><slot wx:if="{{enableA2}}" name="a2"/></a>
              `,
            ),
          })
          .registerComponent()

        const c3 = componentSpace
          .define()
          .options({ dynamicSlots: true })
          .property('enableA1', Boolean)
          .property('enableA2', Boolean)
          .definition({
            template: tmpl(
              `
                <slot wx:if="{{enableA1}}" name="a1" />
                <a>
                  <slot wx:if="{{enableA2}}" name="a2"/>
                  <slot wx:if="{{enableA2}}" name="a2"/>
                </a>
              `,
            ),
          })
          .registerComponent()

        const child = componentSpace
          .define()
          .options({ dynamicSlots: true })
          .property('duplicateSlots', Boolean)
          .definition({
            template: tmpl('<slot /><slot wx:if="{{duplicateSlots}}"/>'),
          })
          .registerComponent()

        const parent = componentSpace
          .define()
          .data(() => ({
            slotName1: 'a1',
            slotContent1: 'A',
            slotName2: 'a1',
            slotContent2: 'B',
            enableA1: false,
            enableA2: false,
            duplicateSlots: false,
          }))
          .usingComponents({
            child,
            c1,
            c2,
            c3,
            x,
          })
          .definition({
            template: tmpl(
              `
                <child duplicate-slots="{{duplicateSlots}}">
                  <c1 enable-a1="{{enableA1}}" enable-a2="{{enableA2}}">
                    <x slot="{{slotName1}}" s="1:{{slotContent1}}">{{slotContent1}}</x>
                    <x slot="{{slotName2}}" s="1:{{slotContent2}}">{{slotContent2}}</x>
                  </c1>
                  <c2 enable-a1="{{enableA1}}" enable-a2="{{enableA2}}">
                    <x slot="{{slotName1}}" s="2:{{slotContent1}}">{{slotContent1}}</x>
                    <x slot="{{slotName2}}" s="2:{{slotContent2}}">{{slotContent2}}</x>
                  </c2>
                  <c3 enable-a1="{{enableA1}}" enable-a2="{{enableA2}}">
                    <x slot="{{slotName1}}" s="3:{{slotContent1}}">{{slotContent1}}</x>
                    <x slot="{{slotName2}}" s="3:{{slotContent2}}">{{slotContent2}}</x>
                  </c3>
                </child>
              `,
            ),
          })
          .registerComponent()

        const parentElem = glassEasel.Component.createWithContext(
          'root',
          parent.general(),
          testBackend,
        ).asInstanceOf(parent)!

        glassEasel.Element.pretendAttached(parentElem)
        expect(domHtml(parentElem)).toBe(
          '<child><c1><a></a></c1><c2><a></a></c2><c3><a></a></c3></child>',
        )
        expect(ops).toEqual([
          [-1, '1:A'],
          [-1, '1:B'],
          [-1, '2:A'],
          [-1, '2:B'],
        ])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ enableA1: true })
        expect(domHtml(parentElem)).toBe(
          '<child><c1><x>A</x><x>B</x><a></a></c1><c2><x>A</x><x>B</x><a></a></c2><c3><x>A</x><x>B</x><a></a></c3></child>',
        )
        expect(ops).toEqual([
          [-1, '3:A'],
          [-1, '3:B'],
        ])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ slotName2: 'a2' })
        expect(domHtml(parentElem)).toBe(
          '<child><c1><x>A</x><x>B</x><a></a></c1><c2><x>A</x><a></a></c2><c3><x>A</x><a></a></c3></child>',
        )
        expect(ops).toEqual([[-2, '3:B']])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ enableA2: true })
        expect(domHtml(parentElem)).toBe(
          '<child><c1><x>A</x><x>B</x><a></a></c1><c2><x>A</x><a><x>B</x></a></c2><c3><x>A</x><a><x>B</x><x>B</x></a></c3></child>',
        )
        expect(ops).toEqual([
          [-1, '3:B'],
          [-1, '3:B'],
        ])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ enableA1: false })
        expect(domHtml(parentElem)).toBe(
          '<child><c1><a><x>A</x><x>B</x></a></c1><c2><a><x>B</x></a></c2><c3><a><x>B</x><x>B</x></a></c3></child>',
        )
        expect(ops).toEqual([[-2, '3:A']])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ duplicateSlots: true })
        expect(domHtml(parentElem)).toBe(
          '<child><c1><a><x>A</x><x>B</x></a></c1><c2><a><x>B</x></a></c2><c3><a><x>B</x><x>B</x></a></c3><c1><a><x>A</x><x>B</x></a></c1><c2><a><x>B</x></a></c2><c3><a><x>B</x><x>B</x></a></c3></child>',
        )
        expect(ops).toEqual([
          [-1, '1:A'],
          [-1, '1:B'],
          [-1, '2:A'],
          [-1, '2:B'],
          [-1, '3:B'],
          [-1, '3:B'],
        ])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ slotName1: 'a2' })
        expect(domHtml(parentElem)).toBe(
          '<child><c1><a><x>A</x><x>B</x></a></c1><c2><a><x>A</x><x>B</x></a></c2><c3><a><x>A</x><x>B</x><x>A</x><x>B</x></a></c3><c1><a><x>A</x><x>B</x></a></c1><c2><a><x>A</x><x>B</x></a></c2><c3><a><x>A</x><x>B</x><x>A</x><x>B</x></a></c3></child>',
        )
        expect(ops).toEqual([
          [-1, '3:A'],
          [-1, '3:A'],
          [-1, '3:A'],
          [-1, '3:A'],
        ])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ enableA2: false })
        expect(domHtml(parentElem)).toBe(
          '<child><c1><a></a></c1><c2><a></a></c2><c3><a></a></c3><c1><a></a></c1><c2><a></a></c2><c3><a></a></c3></child>',
        )
        expect(ops).toEqual([
          [-2, '3:A'],
          [-2, '3:B'],
          [-2, '3:A'],
          [-2, '3:B'],
          [-2, '3:A'],
          [-2, '3:B'],
          [-2, '3:A'],
          [-2, '3:B'],
        ])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ enableA1: true })
        expect(domHtml(parentElem)).toBe(
          '<child><c1><x>A</x><x>B</x><a></a></c1><c2><a></a></c2><c3><a></a></c3><c1><x>A</x><x>B</x><a></a></c1><c2><a></a></c2><c3><a></a></c3></child>',
        )
        expect(ops).toEqual([])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ slotName1: 'a1' })
        expect(domHtml(parentElem)).toBe(
          '<child><c1><x>A</x><x>B</x><a></a></c1><c2><x>A</x><a></a></c2><c3><x>A</x><a></a></c3><c1><x>A</x><x>B</x><a></a></c1><c2><x>A</x><a></a></c2><c3><x>A</x><a></a></c3></child>',
        )
        expect(ops).toEqual([
          [-1, '3:A'],
          [-1, '3:A'],
        ])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ slotContent1: 'C' })
        expect(domHtml(parentElem)).toBe(
          '<child><c1><x>C</x><x>B</x><a></a></c1><c2><x>C</x><a></a></c2><c3><x>C</x><a></a></c3><c1><x>C</x><x>B</x><a></a></c1><c2><x>C</x><a></a></c2><c3><x>C</x><a></a></c3></child>',
        )
        expect(ops).toEqual([])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ duplicateSlots: false })
        expect(domHtml(parentElem)).toBe(
          '<child><c1><x>C</x><x>B</x><a></a></c1><c2><x>C</x><a></a></c2><c3><x>C</x><a></a></c3></child>',
        )
        expect(ops).toEqual([
          [-2, '1:C'],
          [-2, '1:B'],
          [-2, '2:C'],
          [-2, '2:B'],
          [-2, '3:C'],
        ])
        matchElementWithDom(parentElem)
      })

      test('nested outside dynamic slots', () => {
        let ops: Array<[number, string]> = []

        const x = componentSpace
          .define()
          .property('s', String)
          .lifetime('attached', function () {
            ops.push([-1, this.data.s.toString()])
          })
          .lifetime('detached', function () {
            ops.push([-2, this.data.s.toString()])
          })
          .lifetime('moved', function () {
            ops.push([-3, this.data.s.toString()])
          })
          .registerComponent()

        const c1 = componentSpace
          .define()
          .property('enableA1', Boolean)
          .property('enableA2', Boolean)
          .definition({
            template: tmpl(
              `
                <slot wx:if="{{enableA1}}" name="a1" />
                <a><slot wx:if="{{enableA2}}" name="a2"/></a>
              `,
            ),
          })
          .registerComponent()

        const c2 = componentSpace
          .define()
          .options({ multipleSlots: true })
          .property('enableA1', Boolean)
          .property('enableA2', Boolean)
          .definition({
            template: tmpl(
              `
                <slot wx:if="{{enableA1}}" name="a1" />
                <a><slot wx:if="{{enableA2}}" name="a2"/></a>
              `,
            ),
          })
          .registerComponent()

        const c3 = componentSpace
          .define()
          .options({ dynamicSlots: true })
          .property('enableA1', Boolean)
          .property('enableA2', Boolean)
          .definition({
            template: tmpl(
              `
                <slot wx:if="{{enableA1}}" name="a1" />
                <a>
                  <slot wx:if="{{enableA2}}" name="a2"/>
                  <slot wx:if="{{enableA2}}" name="a2"/>
                </a>
              `,
            ),
          })
          .registerComponent()

        const child = componentSpace
          .define()
          .options({ dynamicSlots: true })
          .property('duplicateSlots', Boolean)
          .definition({
            template: tmpl('<slot name="b1" /><slot name="b2" /><slot name="b2" />'),
          })
          .registerComponent()

        const parent = componentSpace
          .define()
          .data(() => ({
            slotName1: 'b1',
            slotContent1: 'A',
            slotName2: 'b1',
            slotContent2: 'B',
            enableA1: false,
            enableA2: false,
            childSlotName: 'a1',
          }))
          .usingComponents({
            child,
            c1,
            c2,
            c3,
            x,
          })
          .definition({
            template: tmpl(
              `
                <c1 enable-a1="{{enableA1}}" enable-a2="{{enableA2}}">
                  <child slot="{{childSlotName}}">
                    <x slot="{{slotName1}}" s="1:{{slotContent1}}">{{slotContent1}}</x>
                    <x slot="{{slotName2}}" s="1:{{slotContent2}}">{{slotContent2}}</x>
                  </child>
                </c1>
                <c2 enable-a1="{{enableA1}}" enable-a2="{{enableA2}}">
                  <child slot="{{childSlotName}}">
                    <x slot="{{slotName1}}" s="2:{{slotContent1}}">{{slotContent1}}</x>
                    <x slot="{{slotName2}}" s="2:{{slotContent2}}">{{slotContent2}}</x>
                  </child>
                </c2>
                <c3 enable-a1="{{enableA1}}" enable-a2="{{enableA2}}">
                  <child slot="{{childSlotName}}">
                    <x slot="{{slotName1}}" s="3:{{slotContent1}}">{{slotContent1}}</x>
                    <x slot="{{slotName2}}" s="3:{{slotContent2}}">{{slotContent2}}</x>
                  </child>
                </c3>
              `,
            ),
          })
          .registerComponent()

        const parentElem = glassEasel.Component.createWithContext(
          'root',
          parent.general(),
          testBackend,
        ).asInstanceOf(parent)!

        glassEasel.Element.pretendAttached(parentElem)
        expect(domHtml(parentElem)).toBe('<c1><a></a></c1><c2><a></a></c2><c3><a></a></c3>')
        expect(ops).toEqual([
          [-1, '1:A'],
          [-1, '1:B'],
          [-1, '2:A'],
          [-1, '2:B'],
        ])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ enableA1: true })
        expect(domHtml(parentElem)).toBe(
          '<c1><child><x>A</x><x>B</x></child><a></a></c1><c2><child><x>A</x><x>B</x></child><a></a></c2><c3><child><x>A</x><x>B</x></child><a></a></c3>',
        )
        expect(ops).toEqual([
          [-1, '3:A'],
          [-1, '3:B'],
        ])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ slotName2: 'b2' })
        expect(domHtml(parentElem)).toBe(
          '<c1><child><x>A</x><x>B</x><x>B</x></child><a></a></c1><c2><child><x>A</x><x>B</x><x>B</x></child><a></a></c2><c3><child><x>A</x><x>B</x><x>B</x></child><a></a></c3>',
        )
        expect(ops).toEqual([
          [-2, '1:B'],
          [-1, '1:B'],
          [-1, '1:B'],
          [-2, '2:B'],
          [-1, '2:B'],
          [-1, '2:B'],
          [-2, '3:B'],
          [-1, '3:B'],
          [-1, '3:B'],
        ])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ enableA2: true })
        expect(domHtml(parentElem)).toBe(
          '<c1><child><x>A</x><x>B</x><x>B</x></child><a></a></c1><c2><child><x>A</x><x>B</x><x>B</x></child><a></a></c2><c3><child><x>A</x><x>B</x><x>B</x></child><a></a></c3>',
        )
        expect(ops).toEqual([])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ childSlotName: 'a2' })
        expect(domHtml(parentElem)).toBe(
          '<c1><child><x>A</x><x>B</x><x>B</x></child><a></a></c1><c2><a><child><x>A</x><x>B</x><x>B</x></child></a></c2><c3><a><child><x>A</x><x>B</x><x>B</x></child><child><x>A</x><x>B</x><x>B</x></child></a></c3>',
        )
        expect(ops).toEqual([
          [-2, '3:A'],
          [-2, '3:B'],
          [-2, '3:B'],
          [-1, '3:A'],
          [-1, '3:B'],
          [-1, '3:B'],
          [-1, '3:A'],
          [-1, '3:B'],
          [-1, '3:B'],
        ])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ slotName1: 'b2' })
        expect(domHtml(parentElem)).toBe(
          '<c1><child><x>A</x><x>B</x><x>A</x><x>B</x></child><a></a></c1><c2><a><child><x>A</x><x>B</x><x>A</x><x>B</x></child></a></c2><c3><a><child><x>A</x><x>B</x><x>A</x><x>B</x></child><child><x>A</x><x>B</x><x>A</x><x>B</x></child></a></c3>',
        )
        expect(ops).toEqual([
          [-2, '1:A'],
          [-1, '1:A'],
          [-1, '1:A'],
          [-2, '2:A'],
          [-1, '2:A'],
          [-1, '2:A'],
          [-2, '3:A'],
          [-1, '3:A'],
          [-1, '3:A'],
          [-2, '3:A'],
          [-1, '3:A'],
          [-1, '3:A'],
        ])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ slotContent1: 'C' })
        expect(domHtml(parentElem)).toBe(
          '<c1><child><x>C</x><x>B</x><x>C</x><x>B</x></child><a></a></c1><c2><a><child><x>C</x><x>B</x><x>C</x><x>B</x></child></a></c2><c3><a><child><x>C</x><x>B</x><x>C</x><x>B</x></child><child><x>C</x><x>B</x><x>C</x><x>B</x></child></a></c3>',
        )
        expect(ops).toEqual([])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ enableA2: false, childSlotName: 'a1' })
        expect(domHtml(parentElem)).toBe(
          '<c1><child><x>C</x><x>B</x><x>C</x><x>B</x></child><a></a></c1><c2><child><x>C</x><x>B</x><x>C</x><x>B</x></child><a></a></c2><c3><child><x>C</x><x>B</x><x>C</x><x>B</x></child><a></a></c3>',
        )
        expect(ops).toEqual([
          [-1, '3:C'],
          [-1, '3:B'],
          [-1, '3:C'],
          [-1, '3:B'],
          [-2, '3:C'],
          [-2, '3:B'],
          [-2, '3:C'],
          [-2, '3:B'],
          [-2, '3:C'],
          [-2, '3:B'],
          [-2, '3:C'],
          [-2, '3:B'],
        ])
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ enableA1: false })
        expect(domHtml(parentElem)).toBe('<c1><a></a></c1><c2><a></a></c2><c3><a></a></c3>')
        expect(ops).toEqual([
          [-2, '3:C'],
          [-2, '3:B'],
          [-2, '3:C'],
          [-2, '3:B'],
        ])
        matchElementWithDom(parentElem)
      })

      test('should support slot props', () => {
        let updateCount = 0
        const subComp = componentSpace
          .define()
          .property('propA', Number)
          .observer('propA', () => {
            updateCount += 1
          })
          .registerComponent()

        const child = componentSpace
          .define()
          .options({ dynamicSlots: true })
          .data(() => ({
            a1: {
              b: [10, 100],
            },
            a2: {
              b: [20, 200],
            },
            c: 0,
          }))
          .definition({
            template: tmpl('<slot a="{{a1}}" c="{{c}}" /><slot a="{{a2}}" c="{{c}}" />'),
          })
          .registerComponent()

        const parent = componentSpace
          .define()
          .usingComponents({ child, 'x-c': subComp })
          .definition({
            template: tmpl(`
              <child>
                <block slot:a="foo" slot:c="bar">
                  <x-c prop-a="{{ foo.b[bar] }}">{{ foo.b[bar] }}</x-c>
                </block>
                <span slot:c>{{c}}</span>
              </child>
            `),
          })
          .registerComponent()

        const parentElem = glassEasel.Component.createWithContext(
          'root',
          parent.general(),
          testBackend,
        ).asInstanceOf(parent)!
        const childElem = parentElem.getShadowRoot()!.childNodes[0]!.asInstanceOf(child)!

        expect(domHtml(parentElem)).toBe(
          '<child><x-c>10</x-c><span>0</span><x-c>20</x-c><span>0</span></child>',
        )
        expect(updateCount).toBe(2)
        matchElementWithDom(parentElem)

        childElem.replaceDataOnPath(['a1', 'b', 0], 11)
        childElem.applyDataUpdates()
        expect(domHtml(parentElem)).toBe(
          '<child><x-c>11</x-c><span>0</span><x-c>20</x-c><span>0</span></child>',
        )
        expect(updateCount).toBe(3)
        matchElementWithDom(parentElem)

        childElem.replaceDataOnPath(['a1', 'b', 0], 12)
        childElem.replaceDataOnPath(['a2', 'b', 0], 21)
        childElem.applyDataUpdates()
        expect(domHtml(parentElem)).toBe(
          '<child><x-c>12</x-c><span>0</span><x-c>21</x-c><span>0</span></child>',
        )
        expect(updateCount).toBe(5)
        matchElementWithDom(parentElem)

        childElem.replaceDataOnPath(['a2', 'b', 1], 201)
        childElem.applyDataUpdates()
        expect(domHtml(parentElem)).toBe(
          '<child><x-c>12</x-c><span>0</span><x-c>21</x-c><span>0</span></child>',
        )
        expect(updateCount).toBe(6)
        matchElementWithDom(parentElem)

        childElem.setData({ c: 1 })
        expect(domHtml(parentElem)).toBe(
          '<child><x-c>100</x-c><span>1</span><x-c>201</x-c><span>1</span></child>',
        )
        expect(updateCount).toBe(8)
        matchElementWithDom(parentElem)
      })

      test('should support duplicate slot props', () => {
        let ops: Array<[number, string]> = []

        const itemComp = componentSpace
          .define()
          .property('s', String)
          .observer('s', (s: string) => {
            ops.push([0, s.toString()])
          })
          .lifetime('attached', function () {
            ops.push([-1, this.data.s.toString()])
          })
          .lifetime('detached', function () {
            ops.push([-2, this.data.s.toString()])
          })
          .lifetime('moved', function () {
            ops.push([-3, this.data.s.toString()])
          })
          .registerComponent()

        const child = componentSpace
          .define()
          .options({ dynamicSlots: true })
          .data(() => ({
            items: [] as number[],
          }))
          .definition({
            template: tmpl(
              '<slot wx:for="{{items}}" item="{{item}}" index="{{index}}" wx:key="*this" />',
            ),
          })
          .registerComponent()

        const parent = componentSpace
          .define()
          .usingComponents({ child, 'x-c': itemComp })
          .data(() => ({
            a: {
              foo: 'foo',
            },
            bar: undefined as string | undefined,
          }))
          .definition({
            template: tmpl(`
              <x-c s="{{a.foo}}" />
              <child>
                <x-c slot:item slot:index s="{{index}}:{{item}}">{{index}}:{{item}}</x-c>
              </child>
            `),
          })
          .registerComponent()

        const parentElem = glassEasel.Component.createWithContext('root', parent, testBackend)
        glassEasel.Element.pretendAttached(parentElem)
        const childElem = parentElem.getShadowRoot()!.childNodes[1]!.asInstanceOf(child)!

        parentElem.replaceDataOnPath(['a', 'foo'], 'oops')

        expect(domHtml(parentElem)).toBe('<x-c></x-c><child></child>')
        expect(ops).toEqual([
          [0, 'foo'],
          [-1, 'foo'],
        ])
        matchElementWithDom(parentElem)

        ops = []
        childElem.setData({ items: [1, 2, 3] })
        expect(domHtml(parentElem)).toBe(
          '<x-c></x-c><child><x-c>0:1</x-c><x-c>1:2</x-c><x-c>2:3</x-c></child>',
        )
        expect(ops).toEqual([
          [0, '0:1'],
          [0, '1:2'],
          [0, '2:3'],
          [-1, '0:1'],
          [-1, '1:2'],
          [-1, '2:3'],
        ])
        matchElementWithDom(parentElem)

        ops = []
        childElem.setData({ items: [4, 5, 6] })
        expect(ops).toEqual([
          [-2, '0:1'],
          [-2, '1:2'],
          [-2, '2:3'],
          [0, '0:4'],
          [0, '1:5'],
          [0, '2:6'],
          [-1, '0:4'],
          [-1, '1:5'],
          [-1, '2:6'],
        ])
        expect(domHtml(parentElem)).toBe(
          '<x-c></x-c><child><x-c>0:4</x-c><x-c>1:5</x-c><x-c>2:6</x-c></child>',
        )
        matchElementWithDom(parentElem)

        ops = []
        childElem.setData({ items: [1, 4, 6, 3, 5, 2] })
        expect(ops).toEqual([
          [0, '0:1'],
          [-1, '0:1'],
          [0, '1:4'],
          [0, '3:3'],
          [-1, '3:3'],
          [0, '4:5'],
          [0, '5:2'],
          [-1, '5:2'],
        ])
        expect(domHtml(parentElem)).toBe(
          '<x-c></x-c><child><x-c>0:1</x-c><x-c>1:4</x-c><x-c>2:6</x-c><x-c>3:3</x-c><x-c>4:5</x-c><x-c>5:2</x-c></child>',
        )
        matchElementWithDom(parentElem)

        ops = []
        childElem.setData({ items: [2, 5, 1, 4, 6, 3] })
        expect(ops).toEqual([
          [0, '0:2'],
          [0, '1:5'],
          [0, '2:1'],
          [0, '3:4'],
          [0, '4:6'],
          [0, '5:3'],
        ])
        expect(domHtml(parentElem)).toBe(
          '<x-c></x-c><child><x-c>0:2</x-c><x-c>1:5</x-c><x-c>2:1</x-c><x-c>3:4</x-c><x-c>4:6</x-c><x-c>5:3</x-c></child>',
        )
        matchElementWithDom(parentElem)

        ops = []
        childElem.setData({ items: [1, 4, 6, 3, 5, 2] })
        expect(ops).toEqual([
          [0, '0:1'],
          [0, '1:4'],
          [0, '2:6'],
          [0, '3:3'],
          [0, '4:5'],
          [0, '5:2'],
        ])
        expect(domHtml(parentElem)).toBe(
          '<x-c></x-c><child><x-c>0:1</x-c><x-c>1:4</x-c><x-c>2:6</x-c><x-c>3:3</x-c><x-c>4:5</x-c><x-c>5:2</x-c></child>',
        )
        matchElementWithDom(parentElem)

        ops = []
        childElem.spliceArrayDataOnPath(['items'], 2, 1, [])
        childElem.applyDataUpdates()
        expect(ops).toEqual([
          [-2, '2:6'],
          [0, '2:3'],
          [0, '3:5'],
          [0, '4:2'],
        ])
        expect(domHtml(parentElem)).toBe(
          '<x-c></x-c><child><x-c>0:1</x-c><x-c>1:4</x-c><x-c>2:3</x-c><x-c>3:5</x-c><x-c>4:2</x-c></child>',
        )
        matchElementWithDom(parentElem)

        ops = []
        childElem.spliceArrayDataOnPath(['items'], 2, 0, [6])
        childElem.applyDataUpdates()
        expect(ops).toEqual([
          [0, '2:6'],
          [-1, '2:6'],
          [0, '3:3'],
          [0, '4:5'],
          [0, '5:2'],
        ])
        expect(domHtml(parentElem)).toBe(
          '<x-c></x-c><child><x-c>0:1</x-c><x-c>1:4</x-c><x-c>2:6</x-c><x-c>3:3</x-c><x-c>4:5</x-c><x-c>5:2</x-c></child>',
        )
        matchElementWithDom(parentElem)

        ops = []
        childElem.setData({ items: [] })
        expect(ops).toEqual([
          [-2, '1:4'],
          [-2, '4:5'],
          [-2, '0:1'],
          [-2, '3:3'],
          [-2, '5:2'],
          [-2, '2:6'],
        ])
        expect(domHtml(parentElem)).toBe('<x-c></x-c><child></child>')
        matchElementWithDom(parentElem)

        ops = []
        parentElem.setData({ bar: '1' })
        expect(ops).toEqual([[0, 'oops']])
      })

      test('should support different deep copy strategies', () => {
        const none = componentSpace
          .define()
          .options({
            dynamicSlots: true,
            dataDeepCopy: glassEasel.DeepCopyKind.None,
            propertyPassingDeepCopy: glassEasel.DeepCopyKind.None,
          })
          .definition({
            template: tmpl(`
              <slot p="{{ sp }}" />
            `),
          })
          .data(() => ({
            sp: {
              text: 123,
            },
          }))
          .registerComponent()

        const rec = componentSpace
          .define()
          .options({
            dynamicSlots: true,
            dataDeepCopy: glassEasel.DeepCopyKind.SimpleWithRecursion,
            propertyPassingDeepCopy: glassEasel.DeepCopyKind.SimpleWithRecursion,
          })
          .definition({
            template: tmpl(`
              <slot p="{{ sp }}" />
            `),
          })
          .data(() => ({
            sp: {
              text: 'abc',
            },
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            recObj: {} as any,
          }))
          .registerComponent()

        const parent = componentSpace
          .define()
          .usingComponents({ none, rec })
          .definition({
            template: tmpl(`
              <none><div slot:p>{{p.text}}</div></none>
              <rec><div slot:p>{{p.text}}</div></rec>
            `),
          })
          .registerComponent()

        const parentElem = glassEasel.Component.createWithContext(
          'root',
          parent.general(),
          testBackend,
        )
        const noneElem = parentElem.getShadowRoot()!.childNodes[0]!.asInstanceOf(none)!
        const recElem = parentElem.getShadowRoot()!.childNodes[1]!.asInstanceOf(rec)!

        expect(domHtml(parentElem)).toBe('<none><div>123</div></none><rec><div>abc</div></rec>')
        matchElementWithDom(parentElem)

        noneElem.setData({ 'sp.text': 456 })
        expect(domHtml(parentElem)).toBe('<none><div>123</div></none><rec><div>abc</div></rec>')
        matchElementWithDom(parentElem)

        noneElem.setData({ sp: { text: 789 } })
        expect(domHtml(parentElem)).toBe('<none><div>789</div></none><rec><div>abc</div></rec>')
        matchElementWithDom(parentElem)

        const recObj = {} as { r: any }
        recObj.r = recObj
        recElem.setData({ sp: { text: 'def' }, recObj })
        expect(domHtml(parentElem)).toBe('<none><div>789</div></none><rec><div>def</div></rec>')
        matchElementWithDom(parentElem)
      })

      test('should support placeholders', () => {
        const placeholder = componentSpace
          .define()
          .options({ dynamicSlots: true })
          .definition({
            template: tmpl(`
              <div>
                <slot text="123" />
              </div>
            `),
          })
          .data(() => ({
            sp: {
              text: 123,
            },
          }))
          .registerComponent()

        const parent = componentSpace
          .define()
          .usingComponents({
            impl: 'impl',
            placeholder,
          })
          .placeholders({
            impl: 'placeholder',
          })
          .definition({
            template: tmpl(`
              <impl><div slot:text>{{text}}</div></impl>
            `),
          })
          .registerComponent()

        const parentElem = glassEasel.Component.createWithContext(
          'root',
          parent.general(),
          testBackend,
        )

        expect(domHtml(parentElem)).toBe('<impl><div><div>123</div></div></impl>')
        matchElementWithDom(parentElem)

        componentSpace
          .define('impl')
          .options({ dynamicSlots: true })
          .definition({
            template: tmpl(`
              <span>
                <slot text="456" />
              </span>
            `),
          })
          .data(() => ({
            sp: {
              text: 123,
            },
          }))
          .registerComponent()

        expect(domHtml(parentElem)).toBe('<impl><span><div>456</div></span></impl>')
        matchElementWithDom(parentElem)
      })
    })
  })

  describe('slot utilities', () => {
    test('get slot element in shadow root', () => {
      const single = componentSpace
        .define()
        .definition({
          template: tmpl('<div id="a"><slot name="a" /></div>'),
        })
        .registerComponent()

      const multi = componentSpace
        .define()
        .options({ multipleSlots: true })
        .definition({
          template: tmpl('<div id="a"><slot name="a" /></div>'),
        })
        .registerComponent()

      const dynamic = componentSpace
        .define()
        .options({ dynamicSlots: true })
        .definition({
          template: tmpl('<div id="a"><slot name="a" /></div>'),
        })
        .registerComponent()

      const parent = componentSpace
        .define()
        .usingComponents({ single, multi, dynamic })
        .definition({
          template: tmpl(`
            <single id="s"><div wx:if="1" slot="a" />S</single>
            <multi id="m"><div wx:if="1" slot="a" />M</multi>
            <dynamic id="d"><div wx:if="1" slot="a" />D</dynamic>
          `),
        })
        .registerComponent()

      const parentElem = glassEasel.Component.createWithContext('root', parent, testBackend)
      const singleElem = (parentElem.$.s as glassEasel.Element).asInstanceOf(single)!
      const multiElem = (parentElem.$.m as glassEasel.Element).asInstanceOf(multi)!
      const dynamicElem = (parentElem.$.d as glassEasel.Element).asInstanceOf(dynamic)!
      const singleSlot = (singleElem.$.a as glassEasel.Element).childNodes[0]!.asElement()!
      const multiSlot = (multiElem.$.a as glassEasel.Element).childNodes[0]!.asElement()!
      const dynamicSlot = (dynamicElem.$.a as glassEasel.Element).childNodes[0]!.asElement()!

      expect(parentElem.getShadowRoot()!.getSlotElementFromName('')).toBe(null)
      expect(singleElem.getShadowRoot()!.getSlotElementFromName('')).toBe(singleSlot)
      expect(multiElem.getShadowRoot()!.getSlotElementFromName('')).toBe(null)
      expect(dynamicElem.getShadowRoot()!.getSlotElementFromName('')).toStrictEqual([])

      expect(parentElem.getShadowRoot()!.getSlotElementFromName('a')).toBe(null)
      expect(singleElem.getShadowRoot()!.getSlotElementFromName('a')).toBe(singleSlot)
      expect(multiElem.getShadowRoot()!.getSlotElementFromName('a')).toBe(multiSlot)
      expect(dynamicElem.getShadowRoot()!.getSlotElementFromName('a')).toStrictEqual([dynamicSlot])

      parentElem.getShadowRoot()!.forEachSlot(() => {
        throw new Error()
      })
      singleElem.getShadowRoot()!.forEachSlot((slot) => {
        expect(slot).toBe(singleSlot)
      })
      multiElem.getShadowRoot()!.forEachSlot((slot) => {
        expect(slot).toBe(multiSlot)
      })
      dynamicElem.getShadowRoot()!.forEachSlot((slot) => {
        expect(slot).toBe(dynamicSlot)
      })

      const checkSlotContentMethods = (
        sr: glassEasel.ShadowRoot,
        slot: glassEasel.Element,
        expectedContent: glassEasel.Node[],
        expectedNode: glassEasel.Node[],
      ) => {
        const contentArr = sr.getSlotContentArray(slot)!
        expect(contentArr?.length).toBe(expectedContent.length)
        for (let i = 0; i < contentArr?.length; i += 1) {
          expect(contentArr[i]).toBe(expectedContent[i])
        }
        let cur = 0
        sr.forEachNodeInSlot((node, s) => {
          if (!s) {
            if (node.asTextNode()) {
              expect(node.asTextNode()!.textContent).toBe('M')
              expect(node.asVirtualNode()).toBe(null)
            } else {
              expect(node.asVirtualNode()).toBeTruthy()
            }
            return
          }
          expect(s).toBe(slot)
          expect(node).toBe(expectedContent[cur])
          cur += 1
        })
        expect(cur).toBe(expectedContent.length)
        cur = 0
        sr.forEachNodeInSpecifiedSlot(slot, (node) => {
          expect(node).toBe(expectedContent[cur])
          cur += 1
        })
        expect(cur).toBe(expectedContent.length)
        cur = 0
        sr.forEachSlotContentInSlot((node, s) => {
          if (!s) {
            if (node.asTextNode()) {
              expect(node.asTextNode()!.textContent).toBe('M')
              expect(node.asVirtualNode()).toBe(null)
            } else {
              expect(node.asVirtualNode()).toBeTruthy()
            }
            return
          }
          expect(s).toBe(slot)
          expect(node).toBe(expectedNode[cur])
          cur += 1
        })
        expect(cur).toBe(expectedNode.length)
        cur = 0
        sr.forEachSlotContentInSpecifiedSlot(slot, (node) => {
          expect(node).toBe(expectedNode[cur])
          cur += 1
        })
        expect(cur).toBe(expectedNode.length)
      }
      checkSlotContentMethods(
        singleElem.getShadowRoot()!,
        singleSlot,
        [
          singleElem.childNodes[0]!,
          (singleElem.childNodes[0] as glassEasel.Element).childNodes[0]!,
          singleElem.childNodes[1]!,
        ],
        [
          (singleElem.childNodes[0] as glassEasel.Element).childNodes[0]!,
          singleElem.childNodes[1]!,
        ],
      )
      checkSlotContentMethods(
        multiElem.getShadowRoot()!,
        multiSlot,
        [(multiElem.childNodes[0] as glassEasel.Element).childNodes[0]!],
        [(multiElem.childNodes[0] as glassEasel.Element).childNodes[0]!],
      )
      checkSlotContentMethods(
        dynamicElem.getShadowRoot()!,
        dynamicSlot,
        [
          dynamicElem.childNodes[0]!,
          (dynamicElem.childNodes[0] as glassEasel.Element).childNodes[0]!,
          dynamicElem.childNodes[1]!,
        ],
        [
          (dynamicElem.childNodes[0] as glassEasel.Element).childNodes[0]!,
          dynamicElem.childNodes[1]!,
        ],
      )
    })
  })
}

describe('slot (DOM backend)', () => testCases(domBackend))
describe('slot (composed backend)', () => testCases(composedBackend))
