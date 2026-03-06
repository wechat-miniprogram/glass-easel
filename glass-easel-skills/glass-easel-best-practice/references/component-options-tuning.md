# Component Options Tuning

## 1. virtualHost (Virtual Host Node)

### Use Cases

Setting `virtualHost: true` prevents the component from generating a real host DOM node; its child nodes are directly mounted to the parent. Applicable for:
- Component acts as a layout container where the host node interferes with flex/grid layout
- Need to reduce DOM depth

```js
.options({
  virtualHost: true,
})
```

### Layout Impact

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

### Solution for class/style Not Working

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

## 2. slot Mode Performance Comparison

Performance ranking of three slot modes: **Single slot > Multiple slots > Dynamic slots**

| Mode | Option | Performance | Slot Content Creation Rule |
|---|---|---|---|
| Single slot | Default | Best | Always created, regardless of whether `<slot />` tag exists |
| Multiple slots | `multipleSlots: true` | Good | Always created, regardless of whether a matching named `<slot />` exists |
| Dynamic slots | `dynamicSlots: true` | Average | Created on demand, created/destroyed along with `<slot />` tag |

### Selection Guidelines

- Use default single slot when named slots are not needed
- Use `multipleSlots: true` when named slots are needed but slot repetition in lists is not
- Use `dynamicSlots: true` when `<slot />` is needed in `wx:for` or slot data passing is required

Note: `multipleSlots` disables glass-easel's single slot-specific optimizations. Do not enable this option for components that don't need multiple slots.

### Performance Implications of Slot Content Creation

In single and multiple slot modes, slot content is **always created**, even if there is no corresponding `<slot />` tag in the component template. This means:
- Components in slot content will normally trigger the `attached` lifetime
- If slot content is heavy, resources are consumed even if not displayed

In dynamic slot mode, slot content is **created on demand**, only when a `<slot />` tag exists. For conditional rendering scenarios, dynamic slots may save more resources.

## 3. Deep Copy Option Priority

Priority of `dataDeepCopy` and `propertyPassingDeepCopy` (from highest to lowest):

1. Component's own `.options()`
2. `ComponentSpace.updateComponentOptions()` of the containing space
3. `globalOptions` global defaults
4. Built-in defaults (`DeepCopyKind.Simple`)

### Global Configuration

```js
// Set defaults on ComponentSpace
componentSpace.updateComponentOptions({
  dataDeepCopy: glassEasel.DeepCopyKind.None,
  propertyPassingDeepCopy: glassEasel.DeepCopyKind.None,
})
```

### Component-level Override

```js
// Individual components that need recursive copy support can override
.options({
  dataDeepCopy: glassEasel.DeepCopyKind.SimpleWithRecursion,
})
```

### Usage Recommendations

If the parent component has disabled `dataDeepCopy`, property objects passed to child components may be shared references. In this case, the child component's `propertyPassingDeepCopy` should also be set to `None`, but the child component must not modify the passed-in objects.

## 4. Trait Behaviors vs Regular Behaviors

### Type Safety Comparison

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

### Code Quality Comparison

| Aspect | Regular Behaviors | Trait Behaviors |
|---|---|---|
| Type Safety | Weak; depends on specific component type | Strong; interface-level type checking |
| Decoupling | Consumer needs to know component type | Consumer only needs to know the interface |
| Interface Conversion | Not supported | Supported (implement interface A, provide interface B) |
| Use Case | Sharing implementation code | Defining component interaction protocols |

Recommendation: Prefer Trait Behaviors for component interaction; use regular Behaviors only when implementation code needs to be shared.
