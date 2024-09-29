import { domBackend, composedBackend, shadowBackend } from '../base/env'
import * as glassEasel from '../../src'

const domHtml = (elem: glassEasel.Element): string => {
  const domElem = elem.getBackendElement() as unknown as Element
  return domElem.outerHTML
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

  it('duplicated class names', () => {
    const element = componentSpace.createComponentByUrl('root', '', {}, testBackend)
    element.setNodeClass('foo bar foo')
    expect(element.class).toBe('foo bar foo')
    expect(domHtml(element)).toBe('<root class="foo bar"></root>')
    element.classList!.toggle('foo', false)
    expect(element.class).toBe('bar foo')
    expect(domHtml(element)).toBe('<root class="foo bar"></root>')
    element.classList!.toggle('foo', false)
    expect(element.class).toBe('bar')
    expect(domHtml(element)).toBe('<root class="bar"></root>')
    element.classList!.toggle('foo', true)
    expect(element.class).toBe('bar foo')
    expect(domHtml(element)).toBe('<root class="bar foo"></root>')
    element.class = 'foo bar foo'
    expect(element.class).toBe('foo bar foo')
    expect(domHtml(element)).toBe('<root class="bar foo"></root>')
    element.class = 'foo bar'
    expect(element.class).toBe('foo bar')
    expect(domHtml(element)).toBe('<root class="bar foo"></root>')
  })
}

describe('classList (DOM backend)', () => testCases(domBackend))
describe('classList (shadow backend)', () => testCases(shadowBackend))
describe('classList (composed backend)', () => testCases(composedBackend))
