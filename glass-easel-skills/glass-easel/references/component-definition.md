# Component Definition Detailed Reference

## Two Definition Styles

| | Definition API | Chaining API (Recommended) |
|---|---|---|
| Entry method | `componentSpace.defineComponent({...})` | `componentSpace.define().xxx().registerComponent()` |
| Code style | Single configuration object | Chained method calls |
| TypeScript support | Limited | Full type inference |
| Logic splitting | Centralized in one object | Chaining allows multiple calls, easy to split |

### Chaining API Example

```js
export const myComponent = componentSpace.define()
  .template(wxml(`<div>{{ message }}</div>`))
  .data(() => ({ message: 'Hello' }))
  .init(({ method, setData }) => {
    const greet = method(() => { setData({ message: 'Hi!' }) })
    return { greet }
  })
  .registerComponent()
```

### Definition API Example

```js
export const myComponent = componentSpace.defineComponent({
  template: wxml(`<div>{{ message }}</div>`),
  data: { message: 'Hello' },
  methods: {
    greet() { this.setData({ message: 'Hi!' }) },
  },
})
```

### Mixing Styles

Use `.definition()` to mix Definition API configuration into Chaining API:

```js
export const myComponent = componentSpace.define()
  .definition({
    data: { count: 0 },
    methods: { reset() { this.setData({ count: 0 }) } },
  })
  .init(({ self, setData, method }) => {
    const increment = method(() => { setData({ count: self.data.count + 1 }) })
    return { increment }
  })
  .registerComponent()
```

## Chaining API Method List

| Method | Description |
|---|---|
| `.template(template)` | Set the template |
| `.data(gen)` | Add data fields (accepts a function that returns an object) |
| `.staticData(data)` | Set static data (cloned on creation) |
| `.property(name, def)` | Add a property |
| `.methods(funcs)` | Batch add methods |
| `.init(func)` | Add initialization function |
| `.lifetime(name, func)` | Add lifetime callback |
| `.pageLifetime(name, func)` | Add page lifetime callback |
| `.observer(paths, func)` | Add data observer |
| `.behavior(beh)` | Include a behavior |
| `.implement(traitBehavior, impl)` | Implement a trait behavior |
| `.usingComponents(list)` | Reference other components |
| `.placeholders(list)` | Set placeholder components |
| `.generics(list)` | Set generics (abstract nodes) |
| `.externalClasses(list)` | Set external classes |
| `.relation(name, rel)` | Add component relation |
| `.definition(def)` | Mix in Definition API configuration |
| `.options(options)` | Set component options |
| `.registerComponent()` | Register as a component |
| `.registerBehavior()` | Register as a behavior |

## Definition API Configuration Fields

| Field | Type | Description |
|---|---|---|
| `is` | `string` | Component path name |
| `behaviors` | `(string \| GeneralBehavior)[]` | Behavior list |
| `using` | `Record<string, string \| ComponentDefinition>` | Referenced components |
| `generics` | `Record<string, { default: ... } \| true>` | Generics (abstract nodes) |
| `placeholders` | `Record<string, string>` | Placeholder components |
| `template` | Compiled template object | Template |
| `externalClasses` | `string[]` | External classes |
| `data` | `TData \| (() => TData)` | Data fields |
| `properties` | `TProperty` | Property definitions |
| `methods` | `TMethod` | Method definitions |
| `listeners` | `Record<string, Function \| string>` | Event listeners |
| `relations` | `Record<string, RelationParams>` | Component relations |
| `lifetimes` | `Record<string, Function>` | Lifetimes |
| `pageLifetimes` | `Record<string, Function>` | Page lifetimes |
| `observers` | `Record<string, Function>` | Data observers |
| `options` | `ComponentOptions` | Component options |

## data

`data` accepts a **function** that returns a data object, ensuring each instance gets an independent copy:

```js
.data(() => ({ message: 'Hello world!' }))
```

`staticData` takes an object directly (deep-copied on creation). Both can be used together; `data` overrides `staticData` fields with the same name. For complex objects, prefer `data(() => ({...}))`.

## property

Properties are externally exposed data fields. The simplest form — pass a type constructor:

```js
.property('name', String)
.property('count', Number)
```

### Type Constructors

| Constructor | Value Type | Default Value |
|---|---|---|
| `String` | `string` | `''` |
| `Number` | `number` | `0` |
| `Boolean` | `boolean` | `false` |
| `Array` | `any[]` | `[]` |
| `Object` | `Record<string, any> \| null` | `null` |
| `Function` | `(...args) => any` | `function() {}` |
| `null` | `any` | `null` |

### Property Configuration Object

```js
.property('count', {
  type: Number,
  value: 1,            // Initial value (will be deep-copied)
  // default: () => 1, // Factory function (recommended, no extra copy)
  observer(newVal, oldVal) { console.log(`count: ${oldVal} -> ${newVal}`) },
  comparer(newVal, oldVal) { return newVal !== oldVal },
})
```

| Field | Type | Description |
|---|---|---|
| `type` | `PropertyType` | Type constructor, defaults to `null` |
| `optionalTypes` | `PropertyType[]` | Additional acceptable types |
| `value` | Corresponds to type | Initial value (will be deep-copied) |
| `default` | `() => V` | Initial value factory function (recommended). When both `value` and `default` exist, `value` is ignored |
| `observer` | `((newVal, oldVal) => void) \| string` | Callback on value change |
| `comparer` | `(newVal, oldVal) => boolean` | Custom comparison; returns `true` to indicate changed, defaults to `!==` |
| `reflectIdPrefix` | `boolean` | Whether to add component id prefix when reflecting to DOM attribute |

Property `observer` only triggers after `comparer` determines the value has changed; data observers trigger whenever the field is set via setData, regardless of whether the value is the same.

## init Function

Executed once per instance creation; defines private variables, methods, lifetimes, observers, etc.:

```js
.init(function ({ self, setData, data, method, listener, lifetime, pageLifetime, observer, implement, relation }) {
  let count = 0
  lifetime('attached', () => { count += 1 })
  observer('a', (newVal) => { console.log(newVal) })

  const greet = method(() => { setData({ hello: `Hello #${count}!` }) })
  const onTap = listener((e) => { console.log('tapped', e.detail) })
  return { greet, onTap }
})
```

### init Parameter Utilities

| Utility | Description |
|---|---|
| `self` | Component instance method caller, equivalent to `this` |
| `setData` | Update data |
| `data` | Current data reference |
| `method` | Mark as a component method, bindable in templates |
| `listener` | Mark as an event listener (TS type signature receives event object) |
| `lifetime` | Register a lifetime |
| `pageLifetime` | Register a page lifetime |
| `observer` | Register a data observer |
| `implement` | Implement a Trait Behavior |
| `relation` | Declare component relations |

`implement`, `relation`, `observer`, `lifetime`, and `pageLifetime` can only be called during `init` execution; calling them afterward will throw an exception.

### method and listener

Both can handle template event bindings. `listener` has clearer semantics, and its TS type signature receives event object parameters.

```js
const increment = method(() => { setData({ count: data.count + 1 }) })
const onTap = listener((event) => { console.log(event.detail) })
```

## methods

Use `.methods()` to batch define methods mounted on `this`. It is recommended to use `method` wrapping in `init` — methods can call each other directly as function variables, and private functions are not exposed on the instance.

## listeners

> ⚠️ **Deprecated**: `listeners` declarative event listening is deprecated. Use `addListener` imperatively to add event listeners instead.

Declaratively bind events on nodes in the Shadow Tree:

```js
.definition({
  listeners: {
    'myDiv.tap': function (e) { /* ... */ },
    'myChild.customEvent': function (e) { /* ... */ },
    'someEvent': function (e) { /* Bound to Shadow Root */ },
    'this.customEvent': function (e) { /* Bound to the component itself */ },
  },
})
```

Key format `{id}.{event}`; omitting the id binds to Shadow Root; id `this` binds to the component itself.

The recommended replacement is to use `addListener` in the `init` function or lifecycle callbacks:

```js
export const myComponent = componentSpace.define()
  .template(wxml(`
    <div id="myDiv">
      <child id="myChild" />
    </div>
  `))
  .init(function ({ self, lifetime }) {
    lifetime('attached', function () {
      this.$.myDiv.addListener('tap', (e) => { /* ... */ })
      this.$.myChild.addListener('customEvent', (e) => { /* ... */ })
      this.$.shadowRoot.addListener('someEvent', (e) => { /* Bound to Shadow Root */ })
      this.addListener('customEvent', (e) => { /* Bound to the component itself */ })
    })
  })
  .registerComponent()
```

> ⚠️ The `id` in `listeners` keys only matches statically present nodes in the template. For dynamic nodes (e.g., nodes controlled by `wx:if`), the `id` may not be correctly located. It is recommended to use `addListener` or bind events directly in the template with `bind:xxx`.

## behaviors

Include a behavior to merge shared properties, methods, and lifetimes:

```js
const sharedBehavior = componentSpace.define()
  .property('shared', String)
  .lifetime('attached', function () { console.log('shared attached') })
  .registerBehavior()

export const myComponent = componentSpace.define()
  .behavior(sharedBehavior)
  .template(wxml(`<div>{{ shared }}</div>`))
  .registerComponent()
```

Fields ignored in behaviors: `template`, `usingComponents`, `generics`, `placeholders`, `options`.

Regular behaviors have weaker type inference in TS; prefer Trait Behaviors.

## implement Trait Behavior

```js
const greetTrait = componentSpace.defineTraitBehavior()

export const myComponent = componentSpace.define()
  .implement(greetTrait, { greet() { return 'hello' } })
  .registerComponent()

// Or in init
.init(({ implement }) => {
  implement(greetTrait, { greet() { return 'hello' } })
})
```

## usingComponents

```js
.usingComponents({
  'my-child': childComponent,     // Component definition object
  'other-child': 'path/to/child', // String path
})
```

## generics (Abstract Nodes)

Certain nodes in the template are set as abstract, with the consumer specifying the implementation:

```js
export const listComponent = componentSpace.define()
  .generics({ item: true })  // No default implementation; with default: { default: comp }
  .template(wxml(`<item />`))
  .registerComponent()
```

Usage: `<list generic:item="my-item" />`

## placeholders

Lazily loaded components are first replaced with placeholders, then automatically replaced once registered:

```js
.usingComponents({ child: 'lazy-components/child', placeholder: placeholderComponent })
.placeholders({ child: 'placeholder' })
```

## externalClasses

Allow consumers to pass in class names: `.externalClasses(['my-class'])`

In template: `<div class="my-class" />`; usage: `<child my-class="some-class" />`.

## options

```js
.options({
  virtualHost: true,       // Virtual host node
  multipleSlots: true,     // Multiple slots
  dynamicSlots: true,      // Dynamic slots
  pureDataPattern: /^_/,   // Pure data field regex
  styleScope: myScope,     // Style isolation scope
  extraStyleScope: myScope, // Extra style scope
  inheritStyleScope: true, // Inherit parent component's style scope
})
```

## relations

```js
.relation('./child', {
  type: 'child',  // child / parent / descendant / ancestor, etc.
  linked(target) { /* On linked */ },
  unlinked(target) { /* On unlinked */ },
})
```

See [Component Interaction Reference](./component-interaction.md#component-relations-relations) for details.
