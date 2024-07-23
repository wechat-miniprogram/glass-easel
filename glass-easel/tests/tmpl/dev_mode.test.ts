import { tmpl, domBackend, composedBackend, shadowBackend } from '../base/env'
import * as glassEasel from '../../src'

const getTmplDevArgs = (n: glassEasel.Node) =>
  (n as glassEasel.Node & { _$wxTmplDevArgs: glassEasel.template.TmplDevArgs })._$wxTmplDevArgs

const testCases = (testBackend: glassEasel.GeneralBackendContext) => {
  test('attribute list', () => {
    const def = glassEasel.registerElement({
      template: tmpl(`
        <div id="a" slot="b" class="c" style="" hidden>
          <slot name="n" v="v"></slot>
        </div>
      `),
    })
    const elem = glassEasel.Component.createWithContext('root', def.general(), testBackend)
    const div = elem.getShadowRoot()!.getElementById('a')!
    expect(getTmplDevArgs(div).A).toStrictEqual([':id', ':slot', ':class', ':style', 'hidden'])
    const slot = div.childNodes[0]!
    expect(getTmplDevArgs(slot).A).toStrictEqual([':name', 'v'])
  })
}

describe('event bindings (DOM backend)', () => testCases(domBackend))
describe('event bindings (shadow backend)', () => testCases(shadowBackend))
describe('event bindings (composed backend)', () => testCases(composedBackend))
