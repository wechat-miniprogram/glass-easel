# Error Handling and Robustness

## 1. error Lifetime

When a lifetime callback or event callback within a component throws an exception, the `error` lifetime is triggered. It is called before global error listeners and can be used for component-level error capture and recovery.

```js
.lifetime('error', function (err) {
  console.error('Internal component exception:', err)
  // Can perform degradation handling here
})
```

### Error Handling Flow

When an exception is caught, glass-easel handles it in the following order:

1. Trigger the component's `error` lifetime (if any)
2. Call all global error listeners
3. If any listener returns `false`, stop further processing
4. If `throwGlobalError` is `true`, re-throw the exception
5. Otherwise, output to `console.error`

### Global Error Listeners

```js
glassEasel.addGlobalErrorListener((err, method, component, element) => {
  // err: Exception object
  // method: Name of the method that threw the exception
  // component: Associated component instance
  // element: Associated node
  reportError(err) // Report the error
  return false     // Return false to prevent console output
})
```

Remove listener: `glassEasel.removeGlobalErrorListener(listener)`

### Global Warning Listeners

```js
glassEasel.addGlobalWarningListener((message, component, element) => {
  // message: Warning message
  logWarning(message)
  return false // Return false to prevent console output
})
```

## 2. safeCallback

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

### Scenarios Where glass-easel Automatically Uses safeCallback

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

### throwGlobalError

Recommended to enable in test scenarios, allowing unintercepted errors to be thrown directly for test framework capture:

```js
glassEasel.globalOptions.throwGlobalError = true
```

## 3. Avoiding Infinite Loops in Data Observers

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

## 4. detached Lifetime Resource Cleanup

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

### Cleanup Checklist

- Timers (`setTimeout`/`setInterval`)
- Network requests (`fetch`/`XMLHttpRequest`)
- Event listeners (global events, `window` events, etc.)
- WebSocket connections
- Animation frames (`requestAnimationFrame`)
- Subscription/observer cancellations
