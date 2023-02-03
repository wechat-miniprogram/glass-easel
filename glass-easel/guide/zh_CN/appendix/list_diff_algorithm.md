# glass-easel 的模板处理

从整体模型角度上看， glass-easel 的作用接近于 web 上的 react 、 vue 等定义式框架。虽然很多设计细节与其他框架大为不同（例如， glass-easel 没有传统意义上的虚拟 DOM 树），但它需要面对很多问题仍然具有一定的相似性。

glass-easel 的基本任务之一是维护 WXML 模板，并将数据套用在模板上，生成 DOM 树；当数据被 `setData` 调用改变时，需要更新对应的 DOM 树内容。

## 模板更新基本原理

从更新原理上看， glass-easel 主要通过在预编译模板时分析得到的表达式和 setData 时改变的数据字段名，来确定 DOM 树中的哪些部分需要更新。例如，对于以下模板：

```html
<view class="{{someClass}}"></view>
```

如果执行以下 `setData` 调用：

```js
this.setData({
  someClass: 'my-class',
})
```

则 `view` 节点的 `class` 可能会被更新。反之，如果执行：

```js
this.setData({
  another: 'something',
})
```

则 `view` 节点的 `class` 不可能被更新。

简而言之， glass-easel 可以预先知道 DOM 树中的某个位置可不可能被更新，并在必要时利用这一信息。

## 列表 diff 问题

然而，在遇到 `wx:for` 和列表数据时，不能仅依靠这种判断。例如，对于以下模板：

```html
<block wx:for="{{list}}" wx:key="{{key}}">
  <view>{{item.value}}</view>
</block>
```

如果原始数据是：

```js
{
  list: [
    { key: 'a', value: 'A' },
    { key: 'b', value: 'B' },
    { key: 'c', value: 'C' },
    { key: 'd', value: 'D' },
  ],
}
```

在此基础上执行 `setData` 调用：

```js
this.setData({
  list: [
    { key: 'c', value: 'C' },
    { key: 'a', value: 'A' },
    { key: 'b', value: 'B' },
  ],
})
```

观察这个列表变化，可发现其实只是把原本列表中的倒数第二项移动到了列表头，并删除了原本列表中的最后一项。

这就要求框架： **根据两个数组的内容，归纳出一组合适的移动、创建、删除操作，并使得操作总数尽可能少。**

## 对 key 的应用

通常，框架会建议在列表中设置一个 `key` 字符串字段，以便框架快速找出各个项目之间的对应关系。例如对于以下这组数据变化：

```js
[ { key: 'a', value: 'A' }, { key: 'b', value: 'B' }, { key: 'c', value: 'C' } ]
// 变为
[ { key: 'b', value: 'B' }, { key: 'c', value: 'C2' }, { key: 'a', value: 'A' } ]
```

框架会将操作归纳为：将 `key: 'a'` 的这一项移动到末尾。至于 `value` 发生的变化，框架此时并不会关心。

在实践中，这通常是一个高效的策略：只要 `key` 是具有足够代表性的信息，如用户 ID 、身份证号等，就可以用很低的开销来确定两个列表中各项之间的对应关系。

这样，整个问题可以进一步被简化为： **对两个给定的 key 数组，归纳出一组合适的移动、创建、删除操作，并使得操作总数尽可能少。**

例如：

```
old: a, b, c
new: b, c, a
```

应归纳出操作：

```
move: a -> 2
```

下文都将按照上述表述方法来举例说明。

# glass-easel list-diff 算法

glass-easel 使用的 list-diff 算法就是基于上述问题设计的。它可以确保操作总数最少，同时，在常规情况下的时间复杂度为 `O(N)` ，最差情况下的算法时间复杂度为 `O(NlogN)` ，并尽可能减少低效的 JS 操作。

## 预处理： key 唯一化

算法需要将列表数据转为 key 数组。为了方便比较，所有 key 都被转换为字符串类型。

此时，可能会产生列表中有重复 key 的情况。这种情况被认为是不合法的，会生成一条警告信息，但算法仍尝试去处理它——重复的 key 会被加上不同的后缀，以便区分它们。例如：

```
new: a, b, b
```

这个列表中有重复 key ，会被进一步转换为：

```
new: a, b--0, b--1
```

（如果碰巧有其他 key 是 `XX--NN` 的形式，则在生成后缀时也会避开它们。）

在检测重复 key 的过程中，会同时生成一个 key 到数组 index 的映射表 `newKeyMap` ；在上一次更新过程中，也有一个同样的表被保留下来，记为 `oldKeyMap` 。例如，对于更新过程：

```
old: a, b, c
new: a, b--0, b--1
```

对应的 `oldKeyMap` 和 `newKeyMap` 分别为：

```
oldKeyMap: { a: 0, b: 1, c: 2 }
newKeyMap: { a: 0, b--0: 1, b--1: 2 }
```

（映射表查询和更新的时间复杂度可视为哈希表的时间复杂度，即 `O(1)` 。但其本身仍是相对较高开销的操作，所以整个算法中也会尽量减少此类操作。）

此外，如果没有指定 `wx:key` ，则不会进行上述步骤（会进入 **快速比较** 子算法）。

## 快速比较

在进入常规算法流程前， glass-easel 会检查当前情况是否适用于快速比较子算法。以下情况中，如满足任意一种，就适用这个子算法：

* 没有指定 `wx:key` ；
* glass-easel 预先判定出此次更新并没有更新列表数据，或者仅仅更新了列表数据中的非 key 字段；
* glass-easel 预先判定出此次更新只是在列表末尾追加项目。

快速比较子算法认为，此时是不会有列表中的已有项目发生移动的，只可能在列表的末尾发生追加或删除。

具体步骤可用伪代码表示如下：

```
fastCompare:
  for i = 0 ~ min(old.length, new.length)
    matchChild(old[i], new[i])
  if old.length > new.length
    for i = new.length ~ old.length
      removeChild(old[i]) // 移除 old 中多余的项目
  if old.length < new.length
    for i = old.length ~ new.length
      appendChild(new[i]) // 追加 new 中多出来的项目
```

只要应用了快速比较子算法，就不用执行后续其他的子算法了。

需要注意的是，如果没有指定 `wx:key` ，虽然本次 list-diff 算法本身比较快，但如果在列表中间插入或删除项目，往往对整个过程的性能具有很大的负面影响。因此，不指定的 `wx:key` 的用法，主要适用于列表项目恒定不变，或者仅在列表末尾增删项目的情况，而不适用于其他情况。

## 最长升子序列算法

不适用快速比较子算法的情况下，会进入后续的常规算法流程。

要想使移动、创建、删除操作尽可能少，因为需要创建、删除的项目的数量是固定的（即 new 中特有的项目和 old 中特有的项目数量），所以算法的核心是使得移动操作尽可能少。

换而言之，就是使得在 old 和 new 中都有的项目中，不需要移动的项目尽可能多。例如：

```
old: a, b, c, d, e
new: a, d, b, c, e
```

可以观察发现， `a` `b` `c` `e` 都不需要移动，只有 `d` 需要移动。找出一种做法使得不需要移动的项目最多就行了。这个问题非常类似于经典的最长公共子序列（ longest common subsequence ）问题。

然而，如果将列表中的每一项都使用 `oldKeyMap` 来替换为 old 中的 index ，则可以变为：

```
oldId: 0, 1, 2, 3, 4
newId: 0, 3, 1, 4, 2
```

这样， `0` `1` `2` 都不需要移动，只有 `3` `4` 需要移动。实际上问题变成：在 new 表中找到一个递增的子序列，并使之尽可能长。这就是经典的最长递增子序列（ longest increasing subsequence ）问题。

这个问题有一个经典的 `O(NlogN)` 解法：在以下标 i 依次扫描 new 表各个项目的同时，维护一个 `minIndexByLen[j]` 数组，表示在所有长度为 j 的子序列中，它们的末项最小可以是多少。

例如，在 i = 1 （只考虑 new 列表的前 2 项）时，它的长度为 1 的子序列有 `0` 和 `3` ，其中较小的一个是 `0` ，所以 `minIndexByLen[1] = 0` 。它的长度为 2 的子序列只有 `0, 3` ，末项是 `3` ，所以 `minIndexByLen[2] = 3` 。同时 `minIndexByLen[3] = inf` 即没有 3 长度的子序列。

当进一步考虑 i = 2 ，即考虑 new 表的第 3 项时，长度为 2 的升子序列有 `0, 3` 和 `0, 1` ，其中较小的末项是 `1` ，所以更新 `minIndexByLen[2] = 1` 。

可以发现， `minIndexByLen` 一定是一个递增数组。用反证法可证，若有 `minIndexByLen[k] >= minIndexByLen[k + 1]` ，即有一个 k 长度的升子序列末项比一个 k + 1 长度的升子序列末项要大，那么后者的前 k 项一定是一个比前者更小的升子序列，矛盾。

更进一步地， i 每增大 1 ，即将 `newId[i]` 计入时，需要新考虑的升子序列的末项一定是 `newId[i]` ，那么，更新 `minIndexByLen` 时，只可能将数组项的值更新为 `newId[i]` ；又因 `minIndexByLen` 的单调性，此次更新只可能更新 `minIndexByLen` 的其中一项。

这样， i 每增大 1 ，就找到最小的 j 使其满足 `newId[i] < minIndexByLen[j]` ，然后更新 `minIndexByLen[j] = newId[i]` 。因为 `minIndexByLen` 单调，这里可以用二分查找算法来找到这个 j 。

最终 `minIndexByLen` 的最后一个非 `inf` 项，就是最长升子序列可能达到的最大长度。

那么这个最长升子序列含有哪些项目呢？

可以考虑另一个数组 `minIndexByLenIndex[j]` 表示使得长度为 j 的最小升子序列末项对应的 i （即这个末项在 new 表中的位置）。每次更新 `minIndexByLen[j] = newId[i]` 时，更新 `minIndexByLenIndex[j] = i` 。

再用另一个数组 `minIndexPrev[i]` 表示当 `newId[i]` 作为长度 j 的子序列末项时，它之前的一项是什么。此时可以简单地取长度为 j - 1 子序列的末项作为倒数第二项。具体来说，每次更新 `minIndexByLen[j] = newId[i]` 时，更新 `minIndexPrev[i] = minIndexByLenIndex[j - 1]` 。这样，通过不断查找 `minIndexPrev` ，就可以连续找到倒数第二项、倒数第三项……直至找到整个子序列。

以例子表述整个过程的话：

```
oldId: 0, 1, 2, 3, 4
newId: 0, 3, 1, 4, 2

// i = 0 时， newId[i] = 0
minIndexByLen:      nil, 0, inf
minIndexByLenIndex: nil, 0
minIndexPrev:       nil

// i = 1 时， newId[i] = 3
minIndexByLen:      nil, 0, 3, inf
minIndexByLenIndex: nil, 0, 1
minIndexPrev:       nil, 0

// i = 2 时， newId[i] = 1
minIndexByLen:      nil, 0, 1, inf
minIndexByLenIndex: nil, 0, 2
minIndexPrev:       nil, 0, 0

// i = 3 时， newId[i] = 4
minIndexByLen:      nil, 0, 1, 4, inf
minIndexByLenIndex: nil, 0, 2, 3
minIndexPrev:       nil, 0, 0, 2

// i = 4 时， newId[i] = 2
minIndexByLen:      nil, 0, 1, 2, inf
minIndexByLenIndex: nil, 0, 2, 4
minIndexPrev:       nil, 0, 0, 2, 2
```

找最长升子序列 `lcs[]` 时，首先取 `minIndexByLenIndex` 的末项作为最后一项，然后在 `minIndexPrev` 中依次找到它之前的各项。

整个求 `lcs[]` 的过程用伪代码可表示如下：

```
calcLcsNaive:
  minIndexByLen = []
  prevMinIndexByLen = []
  minIndexPrev = []
  for i = 0 ~ newId.length
    j = binarySearch(minIndexByLen, newId[i]) // 二分查找
    minIndexByLen[j] = newId[i]
    minIndexByLenIndex[j] = i
    if j > 0
      minIndexPrev[i] = minIndexByLenIndexes[j - 1]
    else
      minIndexPrev[i] = nil
  lcs.length = minIndexByLen.length
  i = lcsLength - 1
  cur = minIndexByLenIndex[i]
  while i >= 0
    lcs[i] = cur
    cur = minIndexPrev[cur]
    i = i - 1
  return lcs
```

整个过程中，对于每个 i 需要执行的最主要操作是一次二分查找，二分查找的时间复杂度是 `O(logN)` ，因而整体时间复杂度为 `O(NlogN)` 。

## 对常见情形的优化

在实践中，常见的情况是，每次列表更新其实都不会大改列表，只是对列表局部进行一些改变。

实例一，在瀑布流加载时，只会在列表末尾进行追加：

```
oldId: 1, 2, 3
newId: 1, 2, 3, nil, nil, nil
```

（这种情况有可能会应用快速比较子算法，也有可能不会。）

实例二，视频弹幕流更新时，总是删除一些头部，再追加一些尾部：

```
oldId: 1, 2, 3, 4, 5
newId: 3, 4, 5, nil, nil
```

实例三，将移动列表中一项从其他位置移动到头部：

```
oldId: 1, 2, 3, 4, 5
newId: 3, 1, 2, 4, 5
```

这些实例中，其实列表中的绝大部分都没有变化，如果都应用朴素的 calcLcsNaive 算法，在实际场景中并不是最优的。

仔细观察上面的几个实例可以发现，很多时候 `newId[i + 1]` 就刚好是 `newId[i] + 1` 。这样，对于每个 i ，可以先不进行二分查找，而是先检查一下 `newId[i + 1] == newId[i] + 1` 。如果成立，根据 `minIndexByLen` 的单调性，在 `minIndexByLen` 中 `newId[i + 1]` 一定紧跟在 `newId[i]` 之后。

常见情况下，上述假定只对个别 i 不成立，这样可以尽量避免二分查找算法，将整体时间复杂度进一步控制在 `O(N)` 。

优化后，求 `lcs[]` 的过程用伪代码可表示如下：

```
calcLcs:
  minIndexByLen = []
  prevMinIndexByLen = []
  minIndexPrev = []
  prevJ = -1
  for i = 0 ~ newId.length
    if i == 0 || newId[i] = newId[i - 1] + 1
      // 满足假定即可避免二分查找
      j = prevJ + 1
    else
      j = binarySearch(minIndexByLen, newId[i])
    prevJ = j
    minIndexByLen[j] = newId[i]
    minIndexByLenIndex[j] = i
    if j > 0
      minIndexPrev[i] = minIndexByLenIndexes[j - 1]
    else
      minIndexPrev[i] = nil
  lcs.length = minIndexByLen.length
  i = lcsLength - 1
  cur = minIndexByLenIndex[i]
  while i >= 0
    lcs[i] = cur
    cur = minIndexPrev[cur]
    i = i - 1
  return lcs
```

此外，在实际实现时，并不需要将 `newId` 数组实际计算出来，而是在需要时，根据 `new` 和 `oldKeyMap` 来获取。这样可以进一步降低开销。

## 统计删除和移动操作

得到最长升子序列 `lcs` 后，所有不在 `lcs[]` 内的项目就是需要变更的。先将这些项目都统计出来：

具体过程用伪代码可表示如下：

```
getOps:
  oldOp = [] // 对于 old 表中每一项应该进行的操作
  newItems = [] // new 表中每一项在 old 表中的位置
  lcsCur = 0
  for i = 0 ~ newId.length
    if newId[i] == nil
      // 对于 old 表中不存在的项目，需要创建
      newItems[i] = -1
    else if i == lcs[lcsCur]
      // 对于 lcs 中的项目，不进行操作
      lcsCur = lcsCur + 1
      oldOp[newId[i]] = NONE 
      newItems[i] = nil
    else
      // 其他项目都需要移动
      oldOp[newId[i]] = MOVE
      newItems[i] = newId[i]
```

最后依次执行这些操作即可。用伪代码表示如下：

```
doOps:
  oldCur = 0
  newCur = 0
  for i = 0 ~ lcs.length
    while oldCur < newId[i]
      if oldOp[oldCur] == nil
        removeChild(old[oldCur])
    while newCur < i
      if newItems[i] == -1
        insertChild(new[newCur], oldCur)
      else
        moveChild(new[newCur], oldCur)
    matchChild(old[oldCur], new[newCur])
    oldCur = newId[i] + 1
    newCur = i + 1
```

这些步骤都是简单的数组操作，不会影响整体算法时间复杂度。

# 性能测试

以下是 glass-easel list-diff 整体算法的列表更新测试性能数据（对比小程序现有 list-diff 算法）。

| 测试项 | 现有 list-diff | glass-easel list-diff |
| ------ | --------------- | ---------------------- |
| 未变更 | 21.3ms | 11ms |
| 批量追加（模拟瀑布流加载） | 76.0ms | 71.6ms |
| 删头加尾（模拟弹幕滚动） | 19.1ms | 15.0ms |
| 单项移动 | 95.6ms | 10.1ms |
| 随机移动 | 146.1ms | 130.0ms |

可见， glass-easel list-diff 总体表现好于原有算法。其中，列表未变化或仅有少量变化时，可以带来巨大的性能提升。

除了自身性能之外， glass-easel list-diff 还带来了最优的项目移动次数、更易预测的项目变更顺序，这些都使得框架整体更友好和高效。
