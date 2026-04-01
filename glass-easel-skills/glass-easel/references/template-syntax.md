# Template Syntax Detailed Reference

WXML syntax, an XML-like markup language. All tags must be properly closed (`<div></div>` or `<div />`).

## Data Binding

`{{ ... }}` embeds expressions; data comes from `data` and `property`:

```xml
<div>{{ a }} + {{ b }} = {{ a + b }}</div>
```

Supports arithmetic, comparison, logical, ternary, string concatenation, object and array literals:

```xml
<div>{{ { name: firstName + ' ' + lastName, age: age } }}</div>
<div>{{ [1, 2, a + b] }}</div>
```

## Conditional Branches

```xml
<div wx:if="{{ a > b }}"> a is greater than b </div>
<div wx:elif="{{ a < b }}"> a is less than b </div>
<div wx:else> a equals b </div>
```

Use `<block>` to control multiple nodes (does not generate a real node):

```xml
<block wx:if="{{ show }}">
  <span>First line</span>
  <span>Second line</span>
</block>
```

## List Rendering

```xml
<div wx:for="{{ arr }}">Item {{ index }}: {{ item }}</div>
```

Custom variable names: `wx:for-index="i"` `wx:for-item="t"`

### wx:key

Provides a unique identifier to assist diffing and improve performance:

```xml
<block wx:for="{{ students }}" wx:key="id">
  <div>{{ item.name }}</div>
</block>
```

Note: Key values must be unique and be numbers or strings; keys do not help when only appending/removing at the end.

## Event Binding

```xml
<div bind:tap="onTap">Click</div>
<child bind:customEvent="onCustomEvent" />
```

### Binding Prefixes

| Prefix | Stop Propagation | Mutually Exclusive | Description |
|---|---|---|---|
| `bind:` | No | No | Normal binding |
| `catch:` | Yes | No | Stops propagation |
| `mut-bind:` | No | Yes | Mutually exclusive binding |
| `capture-bind:` | No | No | Capture phase |
| `capture-catch:` | Yes | No | Capture phase and stops propagation |
| `capture-mut-bind:` | No | Yes | Capture phase mutually exclusive |

It is recommended to always keep the colon (`bind:tap`, not omitted) for better compilation optimization.

## Two-way Binding

`model:` prefix enables two-way binding:

```xml
<child model:count="{{ parentCount }}" />
<textarea model:value="{{ inputText }}" />
```

The `model:` expression must be an assignable data path, not a computed expression.

## class Binding

```xml
<div class:selected class:disabled />
<div class:selected="{{ index === current }}" class:disabled="{{ !enabled }}" />
```

When mixing `class:` with `class=`, `class=` **must not** contain data bindings.

## style Binding

```xml
<div style:color="red" style:font-size="{{ size }}px" />
```

When mixing `style:` with `style=`, `style=` **must not** contain data bindings.

## Template Fragments

```xml
<!-- Definition -->
<template name="user-card">
  <div class="card">
    <div>{{ name }}</div>
    <div>{{ age }} years old</div>
  </div>
</template>

<!-- Usage -->
<template is="user-card" data="{{ name: 'John', age: 20 }}" />
<template is="user-card" data="{{ ...userInfo }}" />
```

`is` supports dynamic switching via data binding: `<template is="type{{ currentType }}" data="{{ value }}" />`

## Template Imports

```xml
<!-- import: imports template fragments -->
<import src="./shared.wxml" />
<template is="shared-template" data="{{ a: 1 }}" />

<!-- include: embeds an entire file -->
<include src="./header.wxml" />
```

## WXS Inline Scripts

```xml
<wxs module="utils" src="./utils.wxs" />
<div>{{ utils.formatDate(timestamp) }}</div>

<wxs module="math">
  exports.sum = function (a, b) { return a + b }
</wxs>
<div>{{ math.sum(1, 2) }}</div>
```

## Temporary Variables let:

Only effective within the containing node and its descendants:

```xml
<block let:tempVar="{{ some.complex.data }}">
  <div>{{ tempVar.name }}</div>
</block>
```

## dataset Attributes data:

Attach custom data to nodes, accessed via `e.target.dataset`:

```xml
<div data:userId="{{ user.id }}" data:userName="{{ user.name }}" bind:tap="onTap" />
```

Also supports `data-` hyphenated syntax (first letter after hyphen is capitalized): `<div data-user-id="123" />` → `dataset.userId`

## Event Marks mark:

On event response, `e.mark` collects marks from the target node and all its ancestors:

```xml
<block wx:for="{{ list }}">
  <div mark:listIndex="{{ index }}">
    <child mark:itemId="{{ item.id }}" bind:customEvent="onEvent" />
  </div>
</block>
```

## slot

```xml
<!-- Child component -->
<div><slot /></div>
<!-- Parent component -->
<child><div>Projected to slot position</div></child>
```

For multiple slots, dynamic slots, and slot data passing, see [Component Interaction Reference](./component-interaction.md#slot).

## Attribute Change Listener change:

Bind a WXS function to listen for child component attribute changes:

```xml
<wxs module="bindUtils">
  exports.onCountChange = function (newVal, oldVal, self, target) {
    console.log('count changed:', newVal)
  }
</wxs>
<child change:count="{{ bindUtils.onCountChange }}" count="{{ count }}" />
```

## Node ID

`<div id="myDiv">Content</div>`, can be found via `self.$` or `getShadowRoot().getElementById()`. Also used to specify event targets in `listeners`.

## Escape Characters

Outside data bindings, use XML Entities: `&gt;` `&lt;`. Inside data bindings, same as JS.
