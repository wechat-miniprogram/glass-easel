# glass-easel Backend Protocol

glass-easel 支持自定义后端。后端必须向 glass-easel 提供以下这些接口，使得 glass-easel 能够正确向后端输出所需信息。


## 本文档说明

### 后端协议模式

后端协议分为两种模式：

* Shadow Mode ： glass-easel 仅工作在 shadow tree 上，由后端完成 shadow tree 到 composed tree 的拼接；
* Composed Mode ： glass-easel 工作在 shadow tree 和 composed tree 上。

两种模式需要的接口不同。仅有其中一种模式下需要的接口，会在这个接口上特别说明。

### 节点类型

节点分为以下类型：

* 普通节点；
* 文本节点（仅承载文本，无子节点）；
* 片段节点（用于临时承载节点树片段）；
* 组件节点（仅 Shadow Mode ，拥有自己的 shadow tree ，可为虚拟或非虚拟）；
* 虚拟节点（仅 Shadow Mode ）。

### 接口形式

后端协议以 TypeScript 为基础语言，接口形式为面向对象形式。

文档中以 `Class#method(...)` 形式标注的接口表示是对应 Class 的实例方法，即 `Class.prototype.method(...)` 。

文档中标记为 async 的接口，统一为回调函数形式，即 `async Class#method(...): T` 实际为 `Class.prototype.method(..., (T) => void)` 。

### 其他说明

* glass-easel 可以保证一个节点的祖先节点列表中一定没有其自身（即不会成环）。


## Context

后端提供的一个对象。每个 Context 实例可以在界面上展示一棵节点树。

### `createContext(options: any, cb: (ContextWrapper) => void)`

创建一个 Context 实例。

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口。应由其他模块调用这个接口并将结果传递给 glass-easel ， `options` 由这些模块与后端约定。

### `ContextWrapper.get(): Context`

获得创建好的 Context 实例。

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口。应由其他模块调用这个接口。

### `Context#mode: ContextMode`

协议模式。

### `Context#destroy(): void`

销毁一个 Context 实例。

glass-easel 并不会自行调用这个接口。应由其他模块调用这个接口。

### `Context#getWindowWidth(): number`

获得这个 Context 的显示区域宽度。

### `Context#getWindowHeight(): number`

获得这个 Context 的显示区域高度。

### `Context#getDevicePixelRatio(): number`

获得这个 Context 的显示区域像素比。

### `Context#getTheme(): string`

获得这个 Context 的当前主题，通常是 `"light"` 或 `"dark"` 其一。

### `Context#registerStyleSheetContent(path: string, content: any)`

注册一段样式表。

`path` 为样式表路径， `content` 为对应的 CSS 样式表。样式表需要是后端可解读的格式。

如果 CSS 中包含 `@import` 等引用逻辑，其路径对应的内容有可能也被另一次 `registerStyleSheetContent` 调用注册，注册时机可能早于或晚于此次注册。

### `Context#appendStyleSheetPath(path: string, styleScope?: number): number`

插入一个样式表项，其内容来自指定的路径。 `styleScope` 是一个可选的 scope 标识符。返回新建的样式表 index 。

如果 styleScope 不为正整数，则视为空；为空时，视为全局生效的样式表。

### `Context#disableStyleSheet(index: number): void`

禁用一段已插入的样式表。

### `Context#addStyleSheetRule(mediaQueryStr: string, selector: string): number | null`

插入一段样式表规则，返回它对应的规则序号。

如果样式表规则无效或插入失败，则返回空值。

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口，但其他相关模块很可能调用。

### `Context#getStyleSheetIndexForNewRules(): number | null`

获取新插入规则所在的样式表序号。

如果失败，则返回空值。

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口，但其他相关模块很可能调用。

### `Context#resetStyleSheetRule(sheetIndex: number, ruleIndex: number): number | null`

重置指定样式表中的指定规则，返回其对应的规则序号。

如果失败，则返回空值。

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口，但其他相关模块很可能调用。

### `Context#modifyStyleSheetRuleSelector(sheetIndex: number, ruleIndex: number，selector: string): number | null`

更改指定样式表中的指定规则的选择器，返回其对应的规则序号。

如果失败，则返回空值。

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口，但其他相关模块很可能调用。

### `Context#addStyleSheetProperty(sheetIndex: number, ruleIndex: number, inlineStyle: string): number | null`

向指定样式表中的指定规则中添加CSS属性，返回其对应的末项属性序号。

如果失败，则返回空值。

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口，但其他相关模块很可能调用。

### `Context#replaceStyleSheetAllProperties(sheetIndex: number, ruleIndex: number, inlineStyle: string): number | null`

替换指定样式表中的指定规则中的全部CSS属性，返回其对应的末项属性序号。

如果失败，则返回空值。

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口，但其他相关模块很可能调用。

### `Context#replaceStyleSheetAllProperties(sheetIndex: number, ruleIndex: number, propertyIndex: number, disabled: boolean): number | null`

开关指定样式表中的指定规则中的指定CSS属性，返回其对应的属性序号。

如果失败，则返回空值。

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口，但其他相关模块很可能调用。

### `Context#removeStyleSheetProperty(sheetIndex: number, ruleIndex: number, propertyIndex: number, disabled: boolean): number | null`

移除指定样式表中的指定规则中的指定CSS属性，返回其对应的属性序号。

如果失败，则返回空值。

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口，但其他相关模块很可能调用。

### `Context#replaceStyleSheetProperty(sheetIndex: number, ruleIndex: number, propertyIndex: number, inlineStyle: string): number | null`

替换指定样式表中的指定规则中的指定CSS属性，返回其对应的属性序号。

如果失败，则返回空值。

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口，但其他相关模块很可能调用。

### `Context#render(cb: (Error | null) => void): void`

等待下一次渲染完成时的回调，即与后端节拍器对齐。

后端必须保证回调是异步的。在回调中，设置新的属性应能触发 CSS transition 动画。

### `Context#getRootNode(): Element`

获得根节点。

**在 Shadow Mode 下** ，根节点必须是组件节点； **在 Composed Mode 下** ，根节点必须是普通节点。

### `Context#createElement(tagName: string): Element`

创建一个普通节点。

**仅 Composed Mode 有效。**

### `Context#createTextNode(content: string): Element`

创建一个文本节点。

**仅 Composed Mode 有效。**

### `Context#createFragment(): Element`

创建一个片段节点。它用于表示节点数组，方便批量插入和移除节点。

### `Context#onEvent(listener: (target: Node, type: string, detail: any, options: EventOptions) => EventBubbleStatus): void`

设置全局事件回调函数。这个回调函数只有一个。

### `Context#setFocusedNode(target: Node): void`

设置焦点所在节点。如果节点不可聚焦，则移除焦点。

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口，但其他相关模块很可能调用。

### `async Context#getFocusedNode(): Node | undefined`

获得焦点所在节点。

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口，但其他相关模块很可能调用。

### `async Context#elementFromPoint(left: number, top: number): Node | undefined`

根据坐标，获得坐标位置上的节点。

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口，但其他相关模块很可能调用。

### `Element#createMediaQueryObserver(...)`

创建一个 MediaQueryObserver 用于监听媒体查询状态变化。

监听器必然在开始监听时触发一次，用于返回初始的媒体查询状态信息。


## Element

### `Element#release(): void`

释放一个节点。

### `Element#associateValue(associatedValue?: Node): void`

通知节点相关信息已经创建完毕，并为节点设置一个关联值。对除文本节点以外的节点都会调用一次。

对于使用 `Context#createElement` 或 `ShadowRootContext#createComponent` 创建的节点，会被调用且仅被调用一次；对于其他节点，不会被调用。

### `Element#getShadowRoot(): ShadowRootContext | undefined`

对于组件节点，返回它的 ShadowRootContext ；否则返回 undefined 。

**仅 Shadow Mode 有效。**

### `Element#appendChild(child: Element): void`

追加一个子节点。

被插入的子节点可以保证是没有父节点的。

### `Element#removeChild(child: Element, index?: number): void`

移除一个子节点。这个子节点可能在后续被再次使用。

如果提供了 `index` ，则它必须等于子节点在子节点列表中的序号。

如果 `index` 不为非负整数，则视为 undefined 。

### `Element#insertBefore(child: Element, before: Element, index?: number): void`

插入一个子节点。根据参数不同有不同行为：

* 如果没提供 `before` 和 `index` ，相当于追加子节点；
* 如果提供了 `before` 或 `index` ，则在它之前插入一个子节点；
* 如果同时提供了 `before` 和 `index` ，则 `index` 必等于 `before` 节点在子节点列表中的序号。

如果 `index` 不为非负整数，则视为 undefined 。

被插入的子节点可以保证是没有父节点的。

### `Element#replaceChild(child: Element, oldChild: Element, index?: number): void`

插入一个子节点。根据参数不同有不同行为：

* 如果没提供 `oldChild` 和 `index` ，相当于追加子节点；
* 如果提供了 `oldChild` 或 `index` ，则替换这个子节点；
* 如果同时提供了 `oldChild` 和 `index` ，则 `index` 必等于 `oldChild` 节点在子节点列表中的序号。

如果 `index` 不为非负整数，则视为 undefined 。

被插入的子节点可以保证是没有父节点的。

### `Element#spliceBefore(before: Element, deleteCount: number, list: Element): void`

删除从 `before` 开始的 `deleteCount` 个节点，并在这个位置插入 `list` 中包含的所有节点。

`list` 必然是片段节点，应被清空，但可能被再次使用。

被插入的所有节点可以保证是没有父节点的。

### `Element#spliceAppend(list: Element): void`

追加 `list` 中包含的所有节点。

`list` 必然是片段节点，应被清空，但可能被再次使用。

被插入的所有节点可以保证是没有父节点的。

### `Element#spliceRemove(before: Element, deleteCount: number): void`

删除从 `before` 开始的 `deleteCount` 个节点。

### `Element#setId(id: string): void`

设置节点 id 。

### `Element#setSlotName(name: string)`

将节点设为 slot 节点并设置 slot name 。

**仅 Shadow Mode 有效。**

### `Element#setSlot(slot: string, inherit: boolean)`

设置节点的目标 slot ；若 `inherit` 为 true ，则将节点设为 slot-inherit 节点。

对于 slot-inherit 节点，它的子节点在 composed tree 上并不视为子节点，而视为它之后的兄弟节点。这可以使得这些子节点拥有不同的目标 slot 。

节点仅在初始化阶段、还没有子节点时才会被设为 slot-inherit 节点；一旦节点被设为 slot-inherit 节点，就不会再被设为非 slot-inherit 节点。

**仅 Shadow Mode 有效。**

### `Element#setStyleScope(styleScope: number): void`

设置节点的 scope 标识符。对于同一个节点，最多被设置一次。

如果 styleScope 不为正整数，则视为空。

在匹配样式规则时，如果使用除 class 以外的节点选择器（如标签名选择器、 ID 选择器）来匹配这个节点，则样式表的 scope 标识符必须为空或等于这个节点的 scope 标识符。

**在 Shadow Mode 下** ，仅对普通节点和非虚组件节点调用； **在 Composed Mode 下** ，仅对普通节点调用。

### `Element#replaceStyleSheetInlineStyle(styleText: string): void`

设置节点 style 。

**在 Shadow Mode 下** ，仅对普通节点和非虚组件节点调用； **在 Composed Mode 下** ，仅对普通节点调用。

### `Element#addClass(elementClass: string, styleScope?: number): void`

为节点添加一个 class 。

如果 styleScope 不为非负整数，则视为空。

在匹配样式规则时，如果使用这个 class 来匹配这个节点，则样式表的 scope 标识符必须为空或等于这个 `styleScope` 。

**在 Shadow Mode 下** ，仅对普通节点和非虚组件节点调用； **在 Composed Mode 下** ，仅对普通节点调用。

### `Element#removeClass(elementClass: string, styleScope?: number): void`

移除指定的 class （如果名称和 styleScope 都能匹配上的话）。

如果 styleScope 不为非负整数，则视为空。

**在 Shadow Mode 下** ，仅对普通节点和非虚组件节点调用； **在 Composed Mode 下** ，仅对普通节点调用。

### `Element#clearClasses(): void`

移除所有 class 。

**在 Shadow Mode 下** ，仅对普通节点和非虚组件节点调用； **在 Composed Mode 下** ，仅对普通节点调用。

### `Element#setAttribute(name: string, value: any): void`

设置节点的一个属性。

仅对普通节点调用。

### `Element#removeAttribute(name: string): void`

移除节点的一个属性。

仅对普通节点调用。

### `Element#setText(content: string): void`

设置文本内容。

仅对文本节点调用。

### `async Element#getContext(): any`

获得与对应节点关联的上下文对象。

glass-easel 并不理解具体的对象细节。

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口，但其他相关模块很可能调用。

### `async Element#getAllComputedStyles(): { properties: CSSProperty[] }`

获得节点的计算样式。其中 `CSSProperty` 定义如下：

```typescript
type CSSProperty = {
  name: string;
  value: string;
  disabled: boolean;
  invalid: boolean;
};
```

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口，但其他相关模块很可能调用。

### `async Element#getMatchedRules(): { inline: CSSProperty[], rules: CSSRule[] }`

获得节点匹配到的样式表规则，包括内联规则。其中 `CSSRule` 定义如下：

```typescript
type glass-easelCSSRule = {
  sheetIndex: number;
  ruleIndex: number;
  mediaQueries: string[];
  selector: string;
  properties: glass-easelCSSProperty[];
  weightHighBits: number;
  weightLowBits: number;
};
```

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口，但其他相关模块很可能调用。

### `async Element#getBoundingClientRect(): { left: number, top: number, width: number, height: number }`

获得节点的外接矩形区域。如果节点不是规整的矩形区域（如是内联文本或被旋转过的矩形），需要计算它的最小外接矩形区域。

如果节点没有布局信息，返回全 0 值。

### `Element#createIntersectionObserver(...)`

创建一个 IntersectionObserver 用于监听相交状态变化。

监听器必然在开始监听时触发一次，用于返回初始的相交状态信息。

### `async Element#getScrollPosition(): { scrollLeft: number, scrollTop: number, scrollWidth: number, scrollHeight: number }`

获得节点的内部滚动位置。

如果节点不可滚动，返回位置 0 值和自身尺寸值。

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口，但其他相关模块很可能调用。

### `Element#setScrollPosition(scrollLeft: number, scrollTop: number, duration: number)`

设置节点的内部滚动位置。如果滚动位置非法或节点不支持滚动，则忽略。

**这只是一个建议性质的接口。** glass-easel 并不会自行调用这个接口，但其他相关模块很可能调用。

### `Element#setEventDefaultPrevented(type: string, enabled: boolean)`

将一个节点上的某个事件响应设置（或取消设置）为禁止默认行为的。

节点上被绑定某个事件的监听器时，无论 `enabled` 值如何，这个调用必然被触发。因此可用于判断该节点是否曾绑定有该事件的监听器。


## ShadowRootContext

代表一个 shadow tree 环境。

**这个对象仅 Shadow Mode 有效。**

### `ShadowRootContext#getRootNode(): Element`

获得根节点。

**仅 Shadow Mode 有效。**

### `ShadowRootContext#createElement(tagName: string): Element`

创建一个普通节点。

**仅 Shadow Mode 有效。**

### `ShadowRootContext#createTextNode(content: string): Element`

创建一个文本节点。

**仅 Shadow Mode 有效。**

### `ShadowRootContext#createComponent(tagName: string, isVirtual: boolean): Element`

创建一个组件节点。可以指定为虚或非虚。虚组件节点的 tagName 无效。

**仅 Shadow Mode 有效。**

### `createExternalComponent(shadowRoot: Element, slot: Element): Element`

创建一个外部组件节点。外部组件是一个已经预建好的后端节点树，与其他部分直接拼接在一起。

**仅 Shadow Mode 有效。**

### `ShadowRootContext#createVirtualNode(): Element`

创建一个虚节点。

**仅 Shadow Mode 有效。**

## enum ContextMode

表示以 Shadow Mode 还是 Composed Mode 运行。

* `ContextMode.Composed = 1` 运行于 Composed Mode ；
* `ConetxtMode.Shadow = 2` 运行于 Shadow Mode 。

## enum EventBubbleStatus

表示冒泡状态。

* `EventBubbleStatus.Normal = 0` 无特殊操作；
* `EventBubbleStatus.NoDefault = 1` 禁用默认操作。
