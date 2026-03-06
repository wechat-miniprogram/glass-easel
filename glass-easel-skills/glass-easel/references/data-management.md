# Data Management Detailed Reference

## setData

`setData` updates data and triggers rendering. In glass-easel, data updates are **synchronous** — after calling it, data and the interface are immediately updated within the same call stack.

```js
.init(({ setData, lifetime }) => {
  lifetime('attached', () => { setData({ message: 'updated!' }) })
})
```

### Path Syntax

Supports dot notation and bracket notation to directly update nested fields:

```js
this.setData({
  'obj.a': 3,
  'obj.a[0]': 5,
  'list[2].name': 'New name',
})
```

Consecutive `setData` calls each independently trigger rendering and are not merged. Use `groupUpdates` or `updateData` + `applyDataUpdates` for batch updates.

## Advanced Path Updates

### replaceDataOnPath

Better performance than `setData`; path is in array form; requires manual `applyDataUpdates`:

```js
this.replaceDataOnPath(['obj', 'a', 0], 3)
this.applyDataUpdates()
```

### spliceArrayDataOnPath

Array insertion and deletion, similar to `Array.prototype.splice`:

```js
this.spliceArrayDataOnPath(['obj', 'arr'], 1, 2, [5, 6, 7])
// [1, 2, 3, 4] => [1, 5, 6, 7, 4]
this.applyDataUpdates()
```

### applyDataUpdates

Must be called after `replaceDataOnPath`/`spliceArrayDataOnPath` to apply changes. Multiple paths can be accumulated before applying all at once.

## Combined Updates

### groupUpdates

Combine multiple changes into a single batch; automatically applied after the callback:

```js
this.groupUpdates(() => {
  this.replaceDataOnPath(['a'], 3)
  this.replaceDataOnPath(['b'], 5)
})
```

### updateData

Same format as `setData` but does not apply immediately; must be used with `applyDataUpdates()` or within `groupUpdates`:

```js
this.groupUpdates(() => {
  this.updateData({ a: 1 })
  this.updateData({ b: 2 })
})
```

`groupUpdates` + `updateData` has better performance than consecutive `setData`, triggering only one render.

## Update Method Comparison

| Method | Immediate Apply | Path Format | Suitable Scenario |
|---|---|---|---|
| `setData({...})` | Yes | String | General purpose |
| `updateData({...})` | No, requires `applyDataUpdates` | String | Batch accumulation |
| `replaceDataOnPath(path, value)` | No, requires `applyDataUpdates` | Array | Precise deep field updates |
| `spliceArrayDataOnPath(path, ...)` | No, requires `applyDataUpdates` | Array | Array insert/delete |
| `groupUpdates(fn)` | Auto after callback | Use above methods in callback | Batch combination |
| `applyDataUpdates()` | Applies accumulated changes | — | Used with above methods |

## Data Observers

Triggered when observed fields are set via `setData`/`updateData`; executed before data is applied to the template.

```js
// Chaining API
.observer(['a', 'b'], function () {
  this.updateData({ sum: this.data.a + this.data.b })
})

// In init
.init(({ self, observer }) => {
  observer(['a', 'b'], () => {
    self.updateData({ sum: self.data.a + self.data.b })
  })
})
```

### Observing Sub-fields and Wildcards

```js
.observer('obj.a, arr[2]', function () { /* Triggered when obj.a or arr[2] is set */ })
.observer('obj.**', function () { /* Triggered when any sub-field of obj is set */ })
.observer('**', function () { /* Triggered when any field is set */ })
```

### Trigger Rules

Data observers are triggered when a field is **set**, even if the value has not changed. This differs from property `observer` (which only triggers after the comparer determines a change).

### Avoiding Infinite Loops

Do not set the fields being observed within the observer. The correct approach — observe source fields, update target fields:

```js
// Correct: observe a and b, update sum
.observer(['a', 'b'], function () {
  this.updateData({ sum: this.data.a + this.data.b })
})
```

### Data Updates Within Observers

Data updated via `updateData` in observer callbacks is only applied after the callback completes. `setData` behaves the same as `updateData` within observers.
