import * as glassEasel from '../../src'
import { domBackend } from '../base/env'

const componentSpace = new glassEasel.ComponentSpace()
componentSpace.updateComponentOptions({
  writeFieldsToNode: true,
})

const createElement = (): glassEasel.NativeNode => {
  const compDef = componentSpace.defineComponent({})
  const root = glassEasel.Component.createWithContext('root', compDef.general(), domBackend)
  return root.getShadowRoot()!.createNativeNode('div')
}

const domElement = (node: glassEasel.NativeNode): Element =>
  node.getBackendElement() as unknown as Element

describe('element style', () => {
  test('an empty initial style does not reach the backend', () => {
    const node = createElement()
    const domNode = domElement(node)
    expect(domNode.getAttribute('style')).toBe(null)
    node.setNodeStyle('')
    // the main segment starts empty, so the first empty style is a no-op
    expect(domNode.getAttribute('style')).toBe(null)
  })

  test('style segments are joined in order', () => {
    const node = createElement()
    const domNode = domElement(node)
    node.setNodeStyle('color: red')
    expect(domNode.getAttribute('style')).toBe('color: red')
    node.setNodeStyle('font-size: 16px', 1)
    node.setNodeStyle('text-align: center', 3)
    expect(domNode.getAttribute('style')).toBe('color: red;font-size: 16px;;text-align: center')
    node.setNodeStyle('')
    // after a real style, an empty main segment is an actual update
    expect(domNode.getAttribute('style')).toBe(';font-size: 16px;;text-align: center')
  })
})
