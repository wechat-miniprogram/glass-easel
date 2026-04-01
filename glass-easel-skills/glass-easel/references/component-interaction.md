# Component Interaction Detailed Reference

## usingComponents

```js
export const myComponent = componentSpace.define()
  .usingComponents({
    'my-child': childComponent,       // Component definition object
    'other-child': 'path/to/child',   // String path
  })
  .template(wxml(`<my-child /><other-child />`))
  .registerComponent()
```

## slot

Child nodes of a parent component are inserted into specified positions in the child component's Shadow Tree via slots.

### Three Modes

| Mode | Option | Description |
|---|---|---|
| Single slot | Default | One anonymous `<slot />` |
| Multiple slots | `multipleSlots: true` | Multiple named slots |
| Dynamic slots | `dynamicSlots: true` | Slots can repeat in loops and pass data |

### Single slot

```js
// Child component
export const child = componentSpace.define()
  .template(wxml(`<div><slot /></div>`))
  .registerComponent()

// Parent component
.template(wxml(`<child><div>Inserted content</div></child>`))
```

In single/multiple slot modes, even if the child component has no `<slot />`, the slot content is still created (triggers `attached`), just not rendered.

### Multiple slots

```js
// Child component
export const child = componentSpace.define()
  .options({ multipleSlots: true })
  .template(wxml(`
    <div><slot name="header" /></div>
    <slot name="footer" />
  `))
  .registerComponent()

// Parent component
.template(wxml(`
  <child>
    <div slot="header">Header</div>
    <div slot="footer">Footer</div>
  </child>
`))
```

Single slot has more optimizations; do not activate `multipleSlots` when it's not needed.

### Dynamic slots

Slots can repeat in loops and pass data to slot content:

```js
// Child component
export const child = componentSpace.define()
  .options({ dynamicSlots: true })
  .template(wxml(`
    <block wx:for="{{ list }}">
      <slot list-index="{{ index }}" item="{{ item }}" />
    </block>
  `))
  .data(() => ({ list: ['A', 'B', 'C'] }))
  .registerComponent()

// Parent component receives data via slot:
.template(wxml(`
  <child>
    <div slot:item>{{ item }}</div>
  </child>
`))
```

`slot:` supports aliases: `<div slot:listIndex="index">Item {{ index }}</div>`

Unlike single/multiple slots, dynamic slot content is only created when the `<slot />` is created, and destroyed when it is removed.

## Regular Behaviors

A code-sharing mechanism for shared properties, methods, lifetimes, etc.

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

Fields ignored in behaviors: `template`, `usingComponents`/`generics`/`placeholders`, `options`.

### Field Conflict Merge Strategy

| Field Type | Strategy |
|---|---|
| Properties/Methods | Later included overrides earlier; component's own takes priority |
| Data | Shallow merge (one level); non-objects overridden by the latter |
| Lifetimes/Page lifetimes/Data observers | Not overridden; executed in inclusion order |

For diamond inheritance, glass-easel automatically deduplicates; the same callback is merged only once.

Regular behaviors have weaker TS type inference; prefer Trait Behaviors.

## Trait Behaviors

Similar to interfaces; define methods that must be implemented, with better TS type support.

```js
const greetTrait = componentSpace.defineTraitBehavior()

// Implement
.implement(greetTrait, { greet() { return 'hello' } })
// Or in init
.init(({ implement }) => {
  implement(greetTrait, { greet() { return 'hello' } })
})

// Usage
const impl = target.traitBehavior(greetTrait)
impl.greet()
```

## Component Relations (relations)

Used for tight logical connections between components; must be **declared in pairs**.

```js
// form component
export const formComponent = componentSpace.define('component/form')
  .relation('./input', {
    type: 'descendant',
    linked(target) { this.getRelationNodes('./input') },
    unlinked(target) {},
  })
  .registerComponent()

// input component
export const inputComponent = componentSpace.define('component/input')
  .relation('./form', {
    type: 'ancestor',
    linked(target) {},
    linkFailed() { /* form not found */ },
  })
  .registerComponent()
```

### Relation Scope

| Scope | Meaning |
|---|---|
| `ancestor`/`descendant` | Ancestor/Descendant |
| `parent`/`child` | Cannot be separated by other component nodes |
| `parent-common-node`/`child-common-node` | Cannot be separated by any node |

### Relation Lifetime Callbacks

| Callback | Trigger Timing |
|---|---|
| `linked` | Linked to a new component |
| `linkChanged` | Related component moved |
| `unlinked` | Related component removed |
| `linkFailed` | Required ancestor not found |

### Trait Behavior-based relations (Recommended)

```js
const FormControl = componentSpace.defineTraitBehavior()

export const formComponent = componentSpace.define()
  .init(({ relation }) => {
    relation({
      type: 'descendant',
      target: FormControl,
      linked(target) {
        const impl = target.traitBehavior(FormControl)
        impl.getName()
      },
    })
  })
  .registerComponent()

export const inputComponent = componentSpace.define()
  .init(({ implement, relation }) => {
    implement(FormControl, { getName() { return 'input' } })
    relation({ type: 'ancestor', target: formComponent })
  })
  .registerComponent()
```

## Generics (Abstract Nodes)

Certain nodes in the template are set as abstract, with the consumer specifying the implementation:

```js
export const listComponent = componentSpace.define()
  .generics({ item: true })  // With default: { default: comp }
  .template(wxml(`<item />`))
  .registerComponent()
```

Usage: `<list generic:item="my-item" />`

## Placeholders

Lazily loaded components are first replaced with placeholders, then automatically replaced once registered:

```js
.usingComponents({ child: 'lazy-components/child', placeholder: placeholderComponent })
.placeholders({ child: 'placeholder' })
```

## Style Isolation (styleScope)

Style is scoped within the component via class prefixes (handled during build by `glass-easel-stylesheet-compiler`).

```js
const myStyleScope = componentSpace.styleScopeManager.register('my-prefix')

export const myComponent = componentSpace.define()
  .options({ styleScope: myStyleScope })
  .template(wxml(`<div class="header" />`))
  .registerComponent()
```

| Option | Description |
|---|---|
| `styleScope` | Primary scope; classes only match prefixed styles |
| `extraStyleScope` | Extra scope; matches both unprefixed and prefixed styles |
| `inheritStyleScope` | Inherit parent component's style scope |

## External Classes (externalClasses)

Allow consumers to pass in class names:

```js
export const child = componentSpace.define()
  .externalClasses(['my-class'])
  .template(wxml(`<div class="my-class" />`))
  .registerComponent()
```

Usage: `<child my-class="custom-style" />`
