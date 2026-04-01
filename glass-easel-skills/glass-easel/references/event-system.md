# Event System Detailed Reference

## Event Model

Similar to the DOM event model, with **capture** and **bubbling** phases:
1. Capture phase (requires `capturePhase` option): Propagates from the outermost ancestor down to the target
2. Bubbling phase (requires `bubbles` option): Propagates from the target up to the ancestor

## triggerEvent

Child component sends an event to the parent component:

```js
self.triggerEvent(eventName, detail, options)
```

| Parameter | Type | Description |
|---|---|---|
| `eventName` | `string` | Event name |
| `detail` | `any` | Accessed via `e.detail` |
| `options` | `object` | Trigger options |

### Trigger Options

| Option | Type | Default | Description |
|---|---|---|---|
| `bubbles` | `boolean` | `false` | Whether to bubble |
| `composed` | `boolean` | `false` | Whether to bubble across Shadow Root (requires `bubbles` as well) |
| `capturePhase` | `boolean` | `false` | Whether to enable capture phase |
| `extraFields` | `Record<string, unknown>` | — | Extra fields attached to the event object |

```js
self.triggerEvent('customEvent', detail)                              // No bubbling
self.triggerEvent('customEvent', detail, { bubbles: true })           // Bubbling
self.triggerEvent('customEvent', detail, { bubbles: true, composed: true }) // Cross-component bubbling
```

## Template Event Binding

| Prefix | Stop Propagation | Mutually Exclusive | Phase |
|---|---|---|---|
| `bind:` | No | No | Bubbling |
| `catch:` | Yes | No | Bubbling |
| `mut-bind:` | No | Yes | Bubbling |
| `capture-bind:` | No | No | Capture |
| `capture-catch:` | Yes | No | Capture |
| `capture-mut-bind:` | No | Yes | Capture |

```xml
<div bind:tap="onTap">Click</div>
<div bind:tap="onOuterTap">
  <button catch:tap="onInnerTap">Only triggers inner</button>
</div>
```

It is recommended to always keep the colon (`bind:tap`) for better compilation optimization.

## Declarative listeners

Declaratively bind events in the component definition:

```js
.definition({
  listeners: {
    'myDiv.tap': function (e) { /* tap on id=myDiv */ },
    'myChild.customEvent': function (e) { /* event on id=myChild */ },
    'someEvent': function (e) { /* Event on Shadow Root */ },
    'this.customEvent': function (e) { /* On the component itself */ },
  },
})
```

Key format `{id}.{event}`; omitting the id binds to Shadow Root; `this` binds to the component itself.

IDs in `listeners` only match static nodes. For dynamic nodes (e.g., `wx:if`), use `bind:` in templates instead.

## addListener / removeListener

Imperatively add/remove listeners:

```js
.init(function ({ self, lifetime }) {
  lifetime('attached', () => {
    self.addListener('customEvent', (e) => { console.log(e.detail) })

    const child = self.getShadowRoot().getElementById('myChild')
    child.addListener('customEvent', (e) => { console.log(e.detail) })
  })
})
```

addListener third parameter `EventListenerOptions`:

| Parameter | Default | Description |
|---|---|---|
| `final` | `false` | Stops propagation after execution (similar to `catch:`) |
| `mutated` | `false` | Marks as mutually exclusive after execution (similar to `mut-bind:`) |
| `capture` | `false` | Listen in capture phase |

Remove: `self.removeListener('customEvent', handler)`

## Mutually Exclusive Events mut-bind:

Does not stop propagation, but all `mut-bind:` bindings along the bubbling path are mutually exclusive: once one executes, subsequent `mut-bind:` bindings will not execute (`bind:` is not affected).

```xml
<div mut-bind:tap="onListItemTap">
  <button mut-bind:tap="onButtonTap">Click button</button>
</div>
<!-- Only onButtonTap executes -->
```

Manual marking in code: `e.markMutated()`

## Event Marks mark:

`e.mark` collects marks from the target node and all its ancestors:

```xml
<block wx:for="{{ list }}">
  <div mark:listIndex="{{ index }}">
    <child mark:itemId="{{ item.id }}" bind:customEvent="onEvent" />
  </div>
</block>
```

```js
const onEvent = listener((e) => {
  e.mark.listIndex // Ancestor
  e.mark.itemId    // Target
})
```

## Event Object

| Property | Description |
|---|---|
| `e.detail` | Event data (second parameter of triggerEvent) |
| `e.target` | Source node that triggered the event |
| `e.target.dataset` | Custom `data:` data of the source node |
| `e.currentTarget` | Node that the listener is bound to |
| `e.mark` | All `mark:` data |
| `e.markMutated()` | Manually mark as mutually exclusive |
