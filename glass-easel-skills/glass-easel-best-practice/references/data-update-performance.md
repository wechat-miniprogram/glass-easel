# Data Update Performance

## 1. Synchronous Update Mechanism

In glass-easel, `setData` is executed synchronously — each call independently triggers one template update. Multiple consecutive `setData` calls each trigger their own update, causing unnecessary rendering overhead.

Anti-pattern:

```js
.lifetime('attached', function () {
  this.setData({ a: 1 }) // Triggers one render
  this.setData({ b: 2 }) // Triggers another render
})
```

## 2. groupUpdates + updateData Batch Updates

Use `groupUpdates` to merge multiple updates into a single render:

```js
.lifetime('attached', function () {
  this.groupUpdates(() => {
    this.updateData({ a: 1 })
    this.updateData({ b: 2 })
  })
  // Only triggers one render
})
```

The difference between `updateData` and `setData`: `updateData` does not immediately trigger rendering; it must be used with `groupUpdates` or within data observers.

## 3. Advanced Path Updates

`replaceDataOnPath` and `spliceArrayDataOnPath` only update specified fields within an object, avoiding processing the entire object path, with better performance than `setData`'s path syntax.

```js
.lifetime('attached', function () {
  this.groupUpdates(() => {
    // Update obj.a[0]
    this.replaceDataOnPath(['obj', 'a', 0], 3)
    // Array splice: starting at index 1, delete 2 items, insert [5, 6]
    this.spliceArrayDataOnPath(['list'], 1, 2, [5, 6])
  })
})
```

Notes:
- After calling `replaceDataOnPath`/`spliceArrayDataOnPath`, rendering does not happen immediately; you need to call `applyDataUpdates()` or wrap in `groupUpdates`.
- Multiple calls can be made consecutively and applied all at once.

## 4. Data Update Behavior in Observers

In data observer callbacks, `setData` and `updateData` behave the same — neither immediately triggers rendering; they are applied uniformly after the observer finishes. Therefore, `updateData` is recommended in observers for clearer semantics.

```js
.observer(['a', 'b'], function () {
  // Recommended: clearer semantics
  this.updateData({ sum: this.data.a + this.data.b })
})
```

Observers can reduce template update count: observers execute before data is applied to the template, and data set within observers is merged with the original update into a single render.

Limitation: Do not set the observed field itself within the observer; otherwise, it will cause an infinite loop.

## 5. Deep Copy Control (dataDeepCopy)

By default, data undergoes a deep copy before updating (`DeepCopyKind.Simple`), preventing direct modification of `this.data` from affecting the template. Three modes:

| Mode | Value | Performance | Description |
|---|---|---|---|
| `Simple` | Default | Average | Does not support recursive fields |
| `SimpleWithRecursion` | Must be set | Worse | Supports recursive fields |
| `None` | Must be set | Best | Completely disables copying, preserves prototype chain |

```js
.options({
  dataDeepCopy: glassEasel.DeepCopyKind.None,
})
```

Limitation: When set to `None`, you must not directly modify `this.data` (e.g., `this.data.a = 2`); otherwise, behavior is unpredictable.

## 6. Property Passing Deep Copy (propertyPassingDeepCopy)

When properties are passed from parent to child components, a deep copy is performed by default. Can be set in the child component:

```js
.options({
  propertyPassingDeepCopy: glassEasel.DeepCopyKind.None,
})
```

Limitation: When set to `None`, the child component must not modify passed-in property objects; otherwise, it may affect parent component data.

## 7. Option Priority

Priority of deep copy options (from highest to lowest):

1. Component's own `.options()`
2. `ComponentSpace.updateComponentOptions()` of the containing space
3. `globalOptions` global defaults
4. Built-in defaults (`Simple`)

Set deep copy options for all components in bulk:

```js
componentSpace.updateComponentOptions({
  dataDeepCopy: glassEasel.DeepCopyKind.None,
  propertyPassingDeepCopy: glassEasel.DeepCopyKind.None,
})
```

## 8. propertyEarlyInit

Default initialization flow: Initialize template with component's own data → trigger `created` → apply external properties → trigger observers → update template again. This means one extra template update.

With `propertyEarlyInit: true`: Merge own data and external properties first → trigger observers → initialize template → trigger `created`. Only one render.

```js
.options({
  propertyEarlyInit: true,
})
```

Limitation: Data observers may trigger before the `created` lifetime; if observers depend on initialization logic in `created`, issues may arise.

## 9. Use Local Variables Instead of Non-rendering Data

Data that does not participate in template rendering should not be placed in `.data` or `.staticData`; instead, use local variables in the `init` function. This avoids unnecessary data overhead and template updates.

```js
.init(({ self, lifetime }) => {
  // Non-rendering state as local variables
  let timer = null
  let requestId = 0

  lifetime('attached', () => {
    timer = setInterval(() => { /* ... */ }, 1000)
  })
  lifetime('detached', () => {
    clearInterval(timer)
  })
})
```

## 10. property comparer to Prevent Unnecessary Updates

Use `comparer` for custom property comparison logic; returning `false` indicates the value has not changed and no update is triggered:

```js
.property('config', {
  type: Object,
  comparer(newVal, oldVal) {
    // Return true to indicate value has changed (needs update), false for unchanged
    return JSON.stringify(newVal) !== JSON.stringify(oldVal)
  },
})
```

A global default comparer can also be set via the component option `propertyComparer`.

## 11. Binding Map Update vs Virtual Tree Update

The glass-easel built-in template engine supports two update methods:

- **Binding map update**: Directly finds corresponding data binding expressions based on changed data field names and updates them. Usually faster and more efficient.
- **Virtual tree update**: Traverses the Shadow Tree that needs updating and updates changed data bindings.

Limitation: Binding map updates cannot be used for data fields inside `wx:if`/`wx:for` subtrees. glass-easel automatically selects the appropriate update method based on the data field names being set.
