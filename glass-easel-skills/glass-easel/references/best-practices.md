# Best Practices: Performance Optimization and Robustness

## Part 1: Data Update Performance

### 1. Synchronous Update Mechanism

In glass-easel, `setData` is executed synchronously — each call independently triggers one template update. Multiple consecutive `setData` calls each trigger their own update, causing unnecessary rendering overhead.

Anti-pattern:

```js
.lifetime('attached', function () {
  this.setData({ a: 1 }) // Triggers one render
  this.setData({ b: 2 }) // Triggers another render
})
```

### 2. groupUpdates + updateData Batch Updates

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

### 3. Advanced Path Updates

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

### 4. Data Update Behavior in Observers

In data observer callbacks, `setData` and `updateData` behave the same — neither immediately triggers rendering; they are applied uniformly after the observer finishes. Therefore, `updateData` is recommended in observers for clearer semantics.

```js
.observer(['a', 'b'], function () {
  // Recommended: clearer semantics
  this.updateData({ sum: this.data.a + this.data.b })
})
```

Observers can reduce template update count: observers execute before data is applied to the template, and data set within observers is merged with the original update into a single render.

Limitation: Do not set the observed field itself within the observer; otherwise, it will cause an infinite loop.

### 5. Deep Copy Control (dataDeepCopy)

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

### 6. Property Passing Deep Copy (propertyPassingDeepCopy)

When properties are passed from parent to child components, a deep copy is performed by default. Can be set in the child component:

```js
.options({
  propertyPassingDeepCopy: glassEasel.DeepCopyKind.None,
})
```

Limitation: When set to `None`, the child component must not modify passed-in property objects; otherwise, it may affect parent component data.

### 7. propertyEarlyInit

Default initialization flow: Initialize template with component's own data → trigger `created` → apply external properties → trigger observers → update template again. This means one extra template update.

With `propertyEarlyInit: true`: Merge own data and external properties first → trigger observers → initialize template → trigger `created`. Only one render.

```js
.options({
  propertyEarlyInit: true,
})
```

Limitation: Data observers may trigger before the `created` lifetime; if observers depend on initialization logic in `created`, issues may arise.

### 8. Use Local Variables Instead of Non-rendering Data

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

### 9. property comparer to Prevent Unnecessary Updates

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

---

## Part 2: List Rendering Performance

### 1. Correct Usage of wx:key

`wx:key` helps the framework identify the correspondence between items during list updates, achieving updates with minimal operations.

#### Basic Usage

```xml
<block wx:for="{{ list }}" wx:key="id">
  <div>{{ item.name }}</div>
</block>
```

#### Usage Guidelines

- **Uniqueness**: `wx:key` values must be unique within the list. Duplicate keys produce warnings, and the framework automatically adds suffixes to distinguish them (e.g., `b--0`, `b--1`), but this incurs additional overhead.
- **Type**: All keys are converted to strings for comparison.
- **Stability**: Keys should remain unchanged throughout the list item's lifetime. Using `index` as a key has no effect when list items are moved.

#### When wx:key Is Needed

- **Must** be specified when list items are reordered, inserted, or deleted in the middle.
- **Must** be specified when list items contain stateful child components; otherwise, component state may become corrupted.

#### When wx:key Is Not Needed

- When list items never change or only append/remove at the end, omitting key can trigger the fast comparison sub-algorithm, which has better performance.
- When list items are purely presentational and contain no components, omitting key has no impact on results.

### 2. Handling Duplicate Keys

When duplicate keys exist in the list:
- The framework generates warning messages
- Duplicate keys get different suffixes to distinguish them (e.g., `a--0`, `a--1`)
- This incurs additional processing overhead and should be avoided

### 3. List Update Optimization Recommendations

For all scenarios below, prefer `spliceArrayDataOnPath` over rebuilding the entire array with `setData`. It works like `Array.prototype.splice`, applying only the minimal change, which avoids re-diffing the whole list.

- **Waterfall loading**: Appending items at the end; specifying or not specifying key makes little performance difference. Use `spliceArrayDataOnPath` with `index` beyond array length to append:

  ```js
  // Append new items at the end (index = undefined means append)
  const newItems = [{ id: 101, text: '...' }, { id: 102, text: '...' }]
  this.spliceArrayDataOnPath(['list'], undefined, 0, newItems)
  this.applyDataUpdates()
  ```

- **Scrolling comments**: Remove-head-append-tail pattern; specify key to reduce unnecessary component recreation. Use `groupUpdates` to batch the two mutations into a single render:

  ```js
  this.groupUpdates(() => {
    // Remove the first item
    this.spliceArrayDataOnPath(['comments'], 0, 1, [])
    // Append a new item at the end
    this.spliceArrayDataOnPath(['comments'], undefined, 0, [newComment])
  })
  ```

- **Single item move** (e.g., pinning/drag sorting): Must specify key; glass-easel shows the most significant performance improvement in this scenario. Remove the item from its old position and insert it at the new position:

  ```js
  const item = this.data.list[fromIndex]
  this.groupUpdates(() => {
    // Remove from old position
    this.spliceArrayDataOnPath(['list'], fromIndex, 1, [])
    // Insert at new position (adjust index if needed after removal)
    const toIdx = toIndex > fromIndex ? toIndex - 1 : toIndex
    this.spliceArrayDataOnPath(['list'], toIdx, 0, [item])
  })
  ```

- **Random rearrangement**: Specify key; glass-easel guarantees minimum operation count. When replacing a contiguous range, use a single splice:

  ```js
  // Replace items at index 1..3 with new shuffled items
  this.spliceArrayDataOnPath(['list'], 1, 3, [
    { id: 10, name: 'A' },
    { id: 11, name: 'B' },
  ])
  this.applyDataUpdates()
  ```

---

## Part 3: Component Options Tuning

### 1. virtualHost (Virtual Host Node)

#### Use Cases

Setting `virtualHost: true` prevents the component from generating a real host DOM node; its child nodes are directly mounted to the parent. Applicable for:
- Component acts as a layout container where the host node interferes with flex/grid layout
- Need to reduce DOM depth

```js
.options({
  virtualHost: true,
})
```

#### Layout Impact

Before enabling (with host DOM node):

```html
<my-component>
  <div class="a">
  <child class="b">     <!-- child is a flex item -->
    <div>child content</div>
```

After enabling (without host DOM node):

```html
<my-component>
  <div class="a">
  <!-- child does not generate a DOM node -->
  <div>child content</div>  <!-- Directly participates in parent container layout -->
```

#### Solution for class/style Not Working

After enabling `virtualHost`, class and style on the component node itself become ineffective. Solution: Declare class as an external class and style as a property, then apply them on internal nodes.

```js
const childComponent = componentSpace.define()
  .options({ virtualHost: true })
  .externalClasses(['class'])
  .property('style', String)
  .template(wxml(`
    <div class="class" style="{{ style }}">child</div>
  `))
  .registerComponent()

// Usage is the same as regular components
// <child class="my-class" style="color: red" />
```

Limitations:
- `getBackendElement()` and `$$` return `null`
- Multiple child nodes of the component are directly exposed to the parent container, which may require an extra wrapper element

### 2. slot Mode Performance Comparison

Performance ranking of three slot modes: **Single slot > Multiple slots > Dynamic slots**

| Mode | Option | Performance | Slot Content Creation Rule |
|---|---|---|---|
| Single slot | Default | Best | Always created, regardless of whether `<slot />` tag exists |
| Multiple slots | `multipleSlots: true` | Good | Always created, regardless of whether a matching named `<slot />` exists |
| Dynamic slots | `dynamicSlots: true` | Average | Created on demand, created/destroyed along with `<slot />` tag |

#### Selection Guidelines

- Use default single slot when named slots are not needed
- Use `multipleSlots: true` when named slots are needed but slot repetition in lists is not
- Use `dynamicSlots: true` when `<slot />` is needed in `wx:for` or slot data passing is required

Note: `multipleSlots` disables glass-easel's single slot-specific optimizations. Do not enable this option for components that don't need multiple slots.

#### Performance Implications of Slot Content Creation

In single and multiple slot modes, slot content is **always created**, even if there is no corresponding `<slot />` tag in the component template. This means:
- Components in slot content will normally trigger the `attached` lifetime
- If slot content is heavy, resources are consumed even if not displayed

In dynamic slot mode, slot content is **created on demand**, only when a `<slot />` tag exists. For conditional rendering scenarios, dynamic slots may save more resources.

### 3. Trait Behaviors vs Regular Behaviors

#### Type Safety Comparison

Regular Behaviors' interface methods lack strict type checking in TypeScript — consumers need to know the specific component type to call methods.

Trait Behaviors provide interface-level type safety:

```ts
// Define interface
interface Toggleable {
  toggle(): void
  isActive(): boolean
}
const toggleableTrait = componentSpace.defineTraitBehavior<Toggleable>()

// Component implements interface
const myComp = componentSpace.define()
  .implement(toggleableTrait, {
    toggle() { /* ... */ },
    isActive() { return true },
  })
  .registerComponent()

// Consumer only needs to know the interface, not the specific component
const impl = child.traitBehavior(toggleableTrait)!
impl.toggle() // Type-safe with full autocompletion
```

#### Code Quality Comparison

| Aspect | Regular Behaviors | Trait Behaviors |
|---|---|---|
| Type Safety | Weak; depends on specific component type | Strong; interface-level type checking |
| Decoupling | Consumer needs to know component type | Consumer only needs to know the interface |
| Interface Conversion | Not supported | Supported (implement interface A, provide interface B) |
| Use Case | Sharing implementation code | Defining component interaction protocols |

Recommendation: Prefer Trait Behaviors for component interaction; use regular Behaviors only when implementation code needs to be shared.

---

## Part 4: Error Handling and Robustness

### 1. error Lifetime

When a lifetime callback or event callback within a component throws an exception, the `error` lifetime is triggered. It is called before global error listeners and can be used for component-level error capture and recovery.

```js
.lifetime('error', function (err) {
  console.error('Internal component exception:', err)
  // Can perform degradation handling here
})
```

#### Error Handling Flow

When an exception is caught, glass-easel handles it in the following order:

1. Trigger the component's `error` lifetime (if any)
2. Call all global error listeners
3. If any listener returns `false`, stop further processing
4. If `throwGlobalError` is `true`, re-throw the exception
5. Otherwise, output to `console.error`

### 2. safeCallback

`safeCallback` wraps a function call with try-catch; caught exceptions automatically enter the error handling flow without interrupting outer logic.

```js
const result = glassEasel.safeCallback(
  'MyOperation',     // Operation name (used in error messages)
  myFunction,        // Function to call
  thisArg,           // this binding
  [arg1, arg2],      // Argument array
  relatedComponent,  // Associated component instance (optional)
)
// Returns the function's return value on success; returns undefined on exception
```

Suitable for executing untrusted or potentially failing callbacks, ensuring exceptions don't interrupt the main flow.

#### Scenarios Where glass-easel Automatically Uses safeCallback

| Category | Scenario |
|---|---|
| Lifetimes | `created`/`attached`/`detached` and other lifetime callbacks, page lifetime callbacks |
| Events | Event listener callbacks |
| Initialization | `.init()` initialization function |
| Data | `.data()` data generator function, property `default` function |
| Observers | Data observers (`observer`), property observers, property comparers (`comparer`) |
| Component Relations | `linked`/`unlinked`/`linkChanged`/`linkFailed` callbacks |
| Other | `ComponentSpace.groupRegister()` callback, backend render completion callback, `MutationObserver` callback |

This means exceptions in all the above scenarios are automatically caught and will not cause program crashes.

### 3. Avoiding Infinite Loops in Data Observers

Data observers trigger when observed fields are set, **even if the value has not changed**. Therefore, the following rule must be observed:

**Rule: Do not set the fields being observed within the observer.**

Bad example:

```js
.observer('a', function () {
  // Infinite loop! Even if the value hasn't changed, setting a triggers the observer again
  this.updateData({ a: 1 })
})
```

Correct pattern — observe source fields, update derived fields:

```js
.observer(['a', 'b'], function () {
  // Correct: observe a/b, update sum (not an observed field)
  this.updateData({
    sum: this.data.a + this.data.b,
  })
})
```

If you truly need to modify a field based on its own value, add a conditional check inside the observer to update only when necessary:

```js
.observer('value', function () {
  const clamped = Math.max(0, Math.min(100, this.data.value))
  if (clamped !== this.data.value) {
    this.updateData({ value: clamped })
  }
})
```

Note: The above pattern still carries risks; `this.data.value` is only a snapshot of the pre-update value when `dataDeepCopy` is not `None`. Prefer the "observe source fields, update derived fields" pattern.

### 4. detached Lifetime Resource Cleanup

`detached` is triggered after the component is removed from the page; suitable for performing cleanup operations. At this point, the component is no longer in the node tree and should not operate on nodes or update data.

```js
.init(({ self, lifetime }) => {
  let timer = null
  let abortController = null

  lifetime('attached', () => {
    // Start timer
    timer = setInterval(() => { /* ... */ }, 1000)
    // Make request
    abortController = new AbortController()
    fetch('/api/data', { signal: abortController.signal })
  })

  lifetime('detached', () => {
    // Clean up timer
    if (timer) {
      clearInterval(timer)
      timer = null
    }
    // Cancel in-progress requests
    if (abortController) {
      abortController.abort()
      abortController = null
    }
  })
})
```
