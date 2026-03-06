# Lifetime Detailed Reference

## Regular Lifetimes

| Lifetime | Trigger Timing | Trigger Count | Notes |
|---|---|---|---|
| `created` | Instance just created | Once per instance | Not yet added to node tree; cannot find parent/sibling nodes |
| `attached` | After being added to the page | At most once | Most common; suitable for initialization |
| `moved` | After being moved in the node tree | Variable count in `wx:for` | |
| `detached` | After being removed from the page | At most once | Should no longer operate on nodes or update data |

### State Transitions

```
Create component → init → created → attached → [moved ↔ attached] → detached → Destroyed
```

## Registration Methods

### Chaining Method

```js
export const myComponent = componentSpace.define()
  .lifetime('attached', function () { console.log('attached') })
  .lifetime('detached', function () { console.log('detached') })
  .registerComponent()
```

### In init (Recommended)

```js
export const myComponent = componentSpace.define()
  .init(({ lifetime }) => {
    lifetime('attached', () => { console.log('attached') })
    lifetime('detached', () => { console.log('detached') })
  })
  .registerComponent()
```

### Definition API

```js
export const myComponent = componentSpace.defineComponent({
  lifetimes: {
    attached() { console.log('attached') },
    detached() { console.log('detached') },
  },
})
```

It is recommended to register in `init`, allowing sharing of closure variables with other logic. `lifetime` can only be called during `init` execution; calling it afterward will throw an exception.

## Other Lifetimes

| Lifetime | Trigger Timing | Description |
|---|---|---|
| `ready` | Component is ready | glass-easel does not trigger this automatically; requires `this.triggerLifetime('ready', [])` |
| `error` | When a lifetime or event callback throws an exception | Parameter `(err: unknown)` |
| `listenerChange` | When event listeners are added/removed | Parameter `(isAdd, name, func, options)`; requires `listenerChangeLifetimes: true` |
| `workletChange` | When a worklet value changes | Requires `this.triggerWorkletChangeLifetime(name, value)` |

```js
.init(({ lifetime }) => {
  lifetime('error', (err) => { console.error('Component error:', err) })
})
```

## Page Lifetimes (pageLifetime)

glass-easel does not trigger these proactively; they are triggered via `triggerPageLifetime`, which automatically propagates recursively to all descendant components.

```js
// Register (recommended in init)
.init(({ pageLifetime }) => {
  pageLifetime('show', () => { console.log('page show') })
  pageLifetime('hide', () => { console.log('page hide') })
})

// Trigger
rootComponent.triggerPageLifetime('show', [])
```

`pageLifetime` can only be called during `init` execution.
