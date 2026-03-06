---
name: glass-easel
description: Provides fundamental knowledge for glass-easel component development, useful as a reference when creating, editing, or reviewing glass-easel components.
---

# glass-easel Component Development Knowledge

## 1. Framework Overview

glass-easel is a declarative rendering component framework. It describes the interface through templates and drives rendering via data binding. Each component has an independent Shadow Tree, and components communicate through properties and events. After `setData`, data and the interface are updated synchronously within the same call stack — there is no asynchronous batched update.

See [Component Definition Reference](./references/component-definition.md) for details.

## 2. Component Definition

Two equivalent styles; **Chaining API is recommended** (full TypeScript type inference, convenient logic splitting).

### Chaining API (Recommended)

```js
import * as glassEasel from 'glass-easel'
import { wxml } from 'glass-easel-template-compiler'

const componentSpace = glassEasel.getDefaultComponentSpace()

export const Counter = componentSpace.define()
  .template(wxml(`
    <div class="counter">
      <div>{{ count }}</div>
      <button bind:tap="increment">+</button>
    </div>
  `))
  .data(() => ({ count: 0 }))
  .init(({ setData, data, method }) => {
    const increment = method(() => {
      setData({ count: data.count + 1 })
    })
    return { increment }
  })
  .registerComponent()
```

### Definition API

```js
export const Counter = componentSpace.defineComponent({
  template: wxml(`
    <div class="counter">
      <div>{{ count }}</div>
      <button bind:tap="increment">+</button>
    </div>
  `),
  data: { count: 0 },
  methods: {
    increment() {
      this.setData({ count: this.data.count + 1 })
    },
  },
})
```

See [Component Definition Reference](./references/component-definition.md) for the full list of chaining methods and configuration fields.

## 3. Core Configuration Options

| Option | Description | Example |
|---|---|---|
| `template` | Compiled template object | `.template(wxml(\`...\`))` |
| `data` | Internal component data (accepts a function) | `.data(() => ({ msg: 'hi' }))` |
| `staticData` | Static data (plain object, deep-copied on creation) | `.staticData({ msg: 'hi' })` |
| `property` | Externally exposed property | `.property('name', String)` |
| `init` | Instance initialization function | `.init(({ method, lifetime }) => { ... })` |
| `methods` | Batch method definitions | `.methods({ fn() {} })` |
| `lifetime` | Lifetime callback | `.lifetime('attached', fn)` |
| `pageLifetime` | Page lifetime callback | `.pageLifetime('show', fn)` |
| `observer` | Data observer | `.observer(['a', 'b'], fn)` |
| `behavior` | Include a behavior | `.behavior(sharedBehavior)` |
| `usingComponents` | Reference other components | `.usingComponents({ child: ChildComp })` |
| `options` | Component options | `.options({ multipleSlots: true })` |

### init Function

`init` is the core entry point for component logic, providing the following utilities:

| Utility | Description |
|---|---|
| `self` | Component instance (equivalent to `this`) |
| `setData` | Update data |
| `data` | Current data reference |
| `method` | Mark as a component method (can be bound in templates) |
| `listener` | Mark as an event listener (TS receives event object) |
| `lifetime` | Register a lifetime |
| `pageLifetime` | Register a page lifetime |
| `observer` | Register a data observer |
| `implement` | Implement a Trait Behavior |
| `relation` | Declare component relations |

```js
.init(({ self, setData, data, method, listener, lifetime, observer }) => {
  let count = 0

  lifetime('attached', () => { count += 1 })
  observer('inputVal', () => {
    setData({ processed: data.inputVal.trim() })
  })

  const greet = method(() => {
    setData({ msg: `Hello #${count}!` })
  })
  const onTap = listener((e) => {
    console.log(e.detail)
  })

  return { greet, onTap }
})
```

See [Component Definition Reference](./references/component-definition.md) for full property configuration and init utility details.

## 4. Template Syntax

WXML syntax; all tags must be properly closed (`<div></div>` or `<div />`).

### Data Binding

```xml
<div>{{ message }}</div>
<div>{{ a + b }}</div>
<div>{{ flag ? 'Yes' : 'No' }}</div>
```

### Conditional Rendering

```xml
<div wx:if="{{ score >= 90 }}">Excellent</div>
<div wx:elif="{{ score >= 60 }}">Pass</div>
<div wx:else>Fail</div>
```

### List Rendering

```xml
<block wx:for="{{ list }}" wx:key="id">
  <div>{{ index }}: {{ item.name }}</div>
</block>
```

Custom variable names: `wx:for-index="i"` `wx:for-item="t"`

### Event Binding

```xml
<button bind:tap="onTap">Normal binding</button>
<button catch:tap="onTap">Stop propagation</button>
<button mut-bind:tap="onTap">Mutually exclusive binding</button>
```

Capture phase: `capture-bind:` / `capture-catch:` / `capture-mut-bind:`

### Two-way Binding

```xml
<child model:count="{{ parentCount }}" />
```

### class / style Binding

```xml
<div class:selected="{{ active }}" class:disabled="{{ !enabled }}" />
<div style:color="red" style:font-size="{{ size }}px" />
```

### slot

```xml
<!-- Child component -->
<div><slot /></div>
<!-- Parent component -->
<child><div>Projected content</div></child>
```

### Other Syntax

- Temporary variables: `<block let:tmp="{{ complex.data }}">{{ tmp.name }}</block>`
- dataset: `<div data:userId="{{ id }}" bind:tap="onTap" />`
- Event marks: `<div mark:index="{{ i }}" bind:tap="onTap" />`
- Template fragments: `<template name="card">...</template>` + `<template is="card" data="{{ ...obj }}" />`
- Template imports: `<import src="./shared.wxml" />` / `<include src="./header.wxml" />`
- WXS scripts: `<wxs module="utils" src="./utils.wxs" />`

See [Template Syntax Reference](./references/template-syntax.md) for full syntax details.

## 5. Event System

### Triggering Events

```js
self.triggerEvent('customEvent', { someData: 'value' })
// Bubbling + cross-component bubbling
self.triggerEvent('customEvent', detail, { bubbles: true, composed: true })
```

triggerEvent options: `bubbles` (bubbling), `composed` (cross-component bubbling), `capturePhase` (capture phase), `extraFields` (extra fields)

### Listening to Events

- Template binding: `bind:` / `catch:` / `mut-bind:` and `capture-` variants
- Declarative listeners: `'nodeId.event': handler` (`this.event` listens to the component itself)
- Imperative: `self.addListener(event, handler, options)` / `self.removeListener(event, handler)`

### Custom Events

```js
// Child component triggers
self.triggerEvent('change', { value: newValue })
// Parent template listens: <child bind:change="onChildChange" />
const onChildChange = listener((e) => { console.log(e.detail.value) })
```

See [Event System Reference](./references/event-system.md) for full details.

## 6. Lifetimes

| Lifetime | Trigger Timing | Common Usage |
|---|---|---|
| `created` | Instance just created | Rarely used (not yet attached to node tree) |
| `attached` | After being attached to the page | **Most common** — initialize data, requests, bindingss |
| `moved` | After being moved in the node tree | Only triggered in `wx:for` |
| `detached` | After being removed from the page | Clean up resources, cancel subscriptions |

```js
.init(({ lifetime }) => {
  lifetime('attached', () => { /* initialization */ })
  lifetime('detached', () => { /* cleanup */ })
})
```

Others: `error` (catches exceptions within the component), `pageLifetime` (page-level broadcasts like `show`/`hide`). See [Lifetime Reference](./references/lifecycle.md) for details.

## 7. Data Updates

### Basic Update

```js
setData({ count: 1 })              // Immediate update
setData({ 'obj.a': 2 })            // Path syntax
setData({ 'list[0].name': 'New' }) // Array path
```

### Advanced Path Updates

```js
self.replaceDataOnPath(['obj', 'a'], 3)          // Replace deep field
self.spliceArrayDataOnPath(['arr'], 1, 2, [5, 6]) // Array splice
self.applyDataUpdates()                           // Apply changes
```

### Batch Updates (Reduce Rendering Count)

```js
self.groupUpdates(() => {
  self.updateData({ a: 1 })
  self.updateData({ b: 2 })
})
```

### Data Observers

```js
observer(['a', 'b'], () => {
  self.updateData({ sum: self.data.a + self.data.b })
})
```

Note: Do not set the fields being observed within the observer, otherwise it will cause an infinite loop. See [Data Management Reference](./references/data-management.md) for details.

## 8. Component Interaction

### Property Passing (Parent → Child)

```xml
<my-child name="{{ userName }}" count="{{ total }}" />
```

### Event Communication (Child → Parent)

```js
// Child component triggers
self.triggerEvent('change', { value: newValue })
// Parent template: <my-child bind:change="onChildChange" />
```

### slot Content Projection

```xml
<!-- Default slot -->
<my-child><div>Content</div></my-child>
<!-- Multiple slots (requires multipleSlots: true) -->
<my-child>
  <div slot="header">Header</div>
  <div slot="footer">Footer</div>
</my-child>
```

### Behaviors Code Reuse

```js
const shared = componentSpace.define()
  .property('name', String)
  .registerBehavior()
// Component includes it
.behavior(shared)
```

### Other Interaction Mechanisms

- **Trait Behaviors**: Similar to interfaces, recommended over regular behaviors
- **relations**: Strong association between parent-child components (e.g., form/input)
- **generics**: Abstract nodes, where the consumer specifies the concrete implementation
- **placeholders**: Placeholders for lazily loaded components
- **styleScope**: Class prefix for style isolation
- **externalClasses**: Allow consumers to pass in custom classes

See [Component Interaction Reference](./references/component-interaction.md) for details.

## 9. Common Patterns

### Counter

```js
export const Counter = componentSpace.define()
  .template(wxml(`
    <div>{{ count }}</div>
    <button bind:tap="increment">+</button>
    <button bind:tap="decrement">-</button>
  `))
  .data(() => ({ count: 0 }))
  .init(({ setData, data, method }) => {
    const increment = method(() => { setData({ count: data.count + 1 }) })
    const decrement = method(() => { setData({ count: data.count - 1 }) })
    return { increment, decrement }
  })
  .registerComponent()
```

### Child Component with Properties and Events

```js
export const MyButton = componentSpace.define()
  .property('label', String)
  .property('disabled', Boolean)
  .template(wxml(`
    <button disabled="{{ disabled }}" bind:tap="onTap">{{ label }}</button>
  `))
  .init(({ self, data, method }) => {
    const onTap = method(() => {
      if (!data.disabled) {
        self.triggerEvent('click', { label: data.label })
      }
    })
    return { onTap }
  })
  .registerComponent()
```

### Referencing Child Components and Communication

```js
export const App = componentSpace.define()
  .usingComponents({ 'my-btn': MyButton })
  .template(wxml(`
    <my-btn label="Submit" bind:click="onBtnClick" />
    <div wx:if="{{ submitted }}">Submitted</div>
  `))
  .data(() => ({ submitted: false }))
  .init(({ setData, method }) => {
    const onBtnClick = method(() => { setData({ submitted: true }) })
    return { onBtnClick }
  })
  .registerComponent()
```

## 10. Notes

1. **API Style**: Prefer the Chaining API
2. **Synchronous Updates**: `setData` is immediately synchronous; consecutive calls each trigger independent renders; use `groupUpdates` for batch updates
3. **method Export**: Functions wrapped with `method`/`listener` in `init` must be `return`ed to be bindable in templates
4. **Data Observers**: Do not set the fields being observed within the observer
5. **property observer vs observer**: Property `observer` only triggers when the value changes; data observers trigger whenever the field is set via setData
6. **Template Closing**: All WXML tags must be properly closed; expressions inside curly braces must be valid JS expressions
7. **Event Colon**: Always use `bind:tap` (with colon), do not omit it
8. **slot Mode**: Prefer single slot (best performance); only enable `multipleSlots` or `dynamicSlots` when needed
9. **behaviors**: Prefer Trait Behaviors (better TS support); use regular behaviors as a compatibility option
