/* eslint-disable import/first */
/* global window, globalThis */

export * from './index'

import * as glassEasel from './index'

const global = typeof globalThis === 'undefined' ? window : globalThis
if (typeof global.__glassEaselDev === 'undefined') {
  global.__glassEaselDev = []
}
const rootComponents = []
// eslint-disable-next-line
global.__glassEaselDev.push({
  glassEasel,
  rootComponents,
})
const replaceDocumentElement = glassEasel.Element.replaceDocumentElement.bind(glassEasel.Element)
glassEasel.Element.replaceDocumentElement = (elem, ...args) => {
  rootComponents.push(elem)
  replaceDocumentElement(elem, ...args)
}
