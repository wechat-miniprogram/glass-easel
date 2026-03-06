---
name: glass-easel-best-practice
description: Provides performance optimization and robustness best practices for glass-easel components, useful as a reference when optimizing or analyzing component performance or robustness.
---

# glass-easel Component Best Practices

## 1. Data Update Performance

### Avoid Consecutive setData

`setData` is executed synchronously; each call independently triggers one template update. Multiple consecutive `setData` calls cause multiple unnecessary renders.

### Use groupUpdates + updateData for Batch Updates

Merge multiple updates into a single render:

```js
self.groupUpdates(() => {
  self.updateData({ a: 1 })
  self.updateData({ b: 2 })
})
// Only triggers one render
```

### Advanced Path Updates

`replaceDataOnPath` and `spliceArrayDataOnPath` only update specified fields, with better performance than `setData`'s path syntax:

```js
self.groupUpdates(() => {
  self.replaceDataOnPath(['obj', 'a'], 3)
  self.spliceArrayDataOnPath(['list'], 1, 2, [5, 6])
})
```

Requires `applyDataUpdates()` afterward or wrapping in `groupUpdates`.

See [Data Update Performance Reference](./references/data-update-performance.md) for details.

## 2. Deep Copy Control

By default, every data update and property passing involves a deep copy. For performance-sensitive scenarios, copying can be disabled:

```js
.options({
  dataDeepCopy: glassEasel.DeepCopyKind.None,
  propertyPassingDeepCopy: glassEasel.DeepCopyKind.None,
})
```

Limitations:
- With `dataDeepCopy: None`, you must not directly modify `this.data`
- With `propertyPassingDeepCopy: None`, child components must not modify passed-in property objects

Can be set in bulk for all components via `ComponentSpace.updateComponentOptions()` or `globalOptions`.

Option priority: component `.options()` > `ComponentSpace` > `globalOptions` > built-in defaults

See [Data Update Performance Reference](./references/data-update-performance.md#5-deep-copy-control-datadeepcopy) for details.

## 3. Component Initialization Optimization propertyEarlyInit

The default initialization flow performs an extra template update after applying external properties. Setting `propertyEarlyInit: true` merges external properties before the first render, resulting in only one render.

```js
.options({
  propertyEarlyInit: true,
})
```

Limitation: Data observers may trigger before the `created` lifetime.

See [Data Update Performance Reference](./references/data-update-performance.md#8-propertyearlyinit) for details.

## 4. Use Local Variables Instead of Non-rendering Data

Data that does not participate in template rendering should not be placed in `.data`/`.staticData`; instead, define and use them as local variables in the `init` function, avoiding unnecessary data overhead and template updates.

```js
.init(({ self, lifetime }) => {
  let timer = null       // State that doesn't need rendering
  let requestId = 0

  lifetime('attached', () => {
    timer = setInterval(() => { /* ... */ }, 1000)
  })
  lifetime('detached', () => {
    clearInterval(timer)
  })
})
```

See [Data Update Performance Reference](./references/data-update-performance.md#9-use-local-variables-instead-of-non-rendering-data) for details.

## 5. List Rendering Performance

### Using wx:key

- **Must** specify `wx:key` when list items are reordered or inserted/deleted in the middle
- When list items never change or only append/remove at the end, omitting key can trigger the fast comparison sub-algorithm
- Key values must be unique within the list and are compared as strings

### List Diff Algorithm Characteristics

- Typical time complexity O(N), worst case O(NlogN)
- Guarantees minimum total number of move, create, and delete operations
- Significant performance advantage for partial list changes (single item move, remove head / append tail, etc.)

### Fast Comparison Sub-algorithm Trigger Conditions

Triggered when any of the following conditions are met, skipping the full diff:
1. `wx:key` is not specified
2. Only non-key fields are updated
3. Only items are appended at the end

Note: When `wx:key` is not specified, inserting/deleting in the middle of the list will cause all subsequent items to be updated.

See [List Rendering Performance Reference](./references/list-rendering-performance.md) for details.

## 6. slot Mode Selection

Performance ranking: **Single slot > Multiple slots > Dynamic slots**

- Use single slot by default (best performance)
- Enable `multipleSlots: true` when named slots are needed
- Enable `dynamicSlots: true` when `<slot />` is needed in `wx:for` or slot data passing is required

Note: `multipleSlots` disables single slot-specific optimizations; do not enable when not needed.

In single/multiple slot modes, slot content is always created (even without a corresponding `<slot />` tag); in dynamic slot mode, content is created on demand.

See [Component Options Tuning Reference](./references/component-options-tuning.md#2-slot-mode-performance-comparison) for details.

## 7. virtualHost (Virtual Host Node)

Setting `virtualHost: true` prevents the component from generating a host DOM node; child nodes are directly mounted to the parent.

Applicable scenarios:
- Component host node interferes with flex/grid layout
- Need to reduce DOM depth

```js
.options({ virtualHost: true })
```

Solution for class/style not working — use external classes and property instead:

```js
.options({ virtualHost: true })
.externalClasses(['class'])
.property('style', String)
.template(wxml(`
  <div class="class" style="{{ style }}">Content</div>
`))
```

Limitation: `getBackendElement()` and `$$` return `null`.

See [Component Options Tuning Reference](./references/component-options-tuning.md#1-virtualhost-virtual-host-node) for details.

## 8. Data Observer Best Practices

### Use updateData Instead of setData

In data observers, `setData` and `updateData` behave the same (both are applied only after the observer finishes). Prefer `updateData` for clearer semantics.

### Reduce Template Update Count

Observers execute before data is applied to the template; data set within observers is merged with the original update into a single render:

```js
.observer(['a', 'b'], function () {
  this.updateData({ sum: this.data.a + this.data.b })
})
// When a or b is set via setData, the sum update is merged into the same render
```

### Avoid Infinite Loops

**Rule: Do not set the fields being observed within the observer.** Observers trigger when a field is set, even if the value has not changed.

```js
// Wrong: observing a, then setting a → infinite loop
.observer('a', function () {
  this.updateData({ a: 1 })
})

// Correct: observe source fields, update derived fields
.observer(['a', 'b'], function () {
  this.updateData({ sum: this.data.a + this.data.b })
})
```

### property comparer

Use `comparer` for custom property comparison; returning `false` indicates the value has not changed and no update is triggered:

```js
.property('config', {
  type: Object,
  comparer(newVal, oldVal) {
    return JSON.stringify(newVal) !== JSON.stringify(oldVal)
  },
})
```

See [Data Update Performance Reference](./references/data-update-performance.md#4-data-update-behavior-in-observers) for details.

## 9. Error Handling

### error Lifetime

Triggered when a lifetime or event callback within the component throws an exception; called before global listeners:

```js
.lifetime('error', function (err) {
  console.error('Component exception:', err)
})
```

### Global Error/Warning Listeners

```js
glassEasel.addGlobalErrorListener((err, method, component, element) => {
  reportError(err)
  return false // Prevent console output
})
```

### safeCallback

Wraps a function call with try-catch; exceptions automatically enter the error handling flow without interrupting outer logic:

```js
const result = glassEasel.safeCallback(
  'MyOperation', myFunction, thisArg, [arg1], component
)
```

glass-easel internally uses safeCallback in the following scenarios: lifetime callbacks, event listeners, `.init()` initialization functions, `.data()` generators, data/property observers, component relation callbacks, etc.

See [Error Handling Reference](./references/error-handling.md) for details.

## 10. Type-safe Trait Behaviors

Trait Behaviors provide interface-level type safety for decoupled interaction between components:

```ts
interface Toggleable {
  toggle(): void
  isActive(): boolean
}
const toggleableTrait = componentSpace.defineTraitBehavior<Toggleable>()

// Implement
.implement(toggleableTrait, {
  toggle() { /* ... */ },
  isActive() { return true },
})

// Usage (only need to know the interface, not the specific component)
const impl = child.traitBehavior(toggleableTrait)!
impl.toggle()
```

Advantages: Type-safe autocompletion, decoupling between consumers and implementers, supports interface conversion.

Prefer Trait Behaviors for component interaction; use regular Behaviors only when implementation code needs to be shared.

See [Component Options Tuning Reference](./references/component-options-tuning.md#4-trait-behaviors-vs-regular-behaviors) for details.

## 11. Resource Cleanup

Clean up all resources in the `detached` lifetime to prevent memory leaks:

```js
.init(({ lifetime }) => {
  let timer = null
  let abortCtrl = null

  lifetime('attached', () => {
    timer = setInterval(() => { /* ... */ }, 1000)
    abortCtrl = new AbortController()
    fetch('/api', { signal: abortCtrl.signal })
  })

  lifetime('detached', () => {
    if (timer) { clearInterval(timer); timer = null }
    if (abortCtrl) { abortCtrl.abort(); abortCtrl = null }
  })
})
```

Cleanup checklist:
- Timers (`setTimeout`/`setInterval`)
- Network requests
- Global/window event listeners
- WebSocket connections
- Animation frames (`requestAnimationFrame`)
- Subscription/observer cancellations

See [Error Handling Reference](./references/error-handling.md#4-detached-lifetime-resource-cleanup) for details.

## 12. Binding Map Updates

The glass-easel built-in template engine supports two update methods:
- **Binding map update**: Directly finds corresponding binding expressions based on data field names and updates them; usually faster
- **Virtual tree update**: Traverses the Shadow Tree to update changed bindings

The framework automatically chooses based on the data field names being set. Binding map updates cannot be used for data fields inside `wx:if`/`wx:for` subtrees.

See [Data Update Performance Reference](./references/data-update-performance.md#11-binding-map-update-vs-virtual-tree-update) for details.
