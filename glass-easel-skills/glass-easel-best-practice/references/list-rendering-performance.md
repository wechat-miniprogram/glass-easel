# List Rendering Performance

## 1. Correct Usage of wx:key

`wx:key` helps the framework identify the correspondence between items during list updates, achieving updates with minimal operations.

### Basic Usage

```xml
<block wx:for="{{ list }}" wx:key="id">
  <div>{{ item.name }}</div>
</block>
```

### Usage Guidelines

- **Uniqueness**: `wx:key` values must be unique within the list. Duplicate keys produce warnings, and the framework automatically adds suffixes to distinguish them (e.g., `b--0`, `b--1`), but this incurs additional overhead.
- **Type**: All keys are converted to strings for comparison.
- **Stability**: Keys should remain unchanged throughout the list item's lifetime. Using `index` as a key has no effect when list items are moved.

### When wx:key Is Needed

- **Must** be specified when list items are reordered, inserted, or deleted in the middle.
- **Must** be specified when list items contain stateful child components; otherwise, component state may become corrupted.

### When wx:key Is Not Needed

- When list items never change or only append/remove at the end, omitting key can trigger the fast comparison sub-algorithm, which has better performance.
- When list items are purely presentational and contain no components, omitting key has no impact on results.

## 2. Core Characteristics of List Diff Algorithm

The glass-easel list diff algorithm has the following characteristics:

- **Typical time complexity O(N)**: For most real-world scenarios (partial list changes), only linear time is needed.
- **Worst case time complexity O(NlogN)**: Degrades to O(NlogN) for completely random rearrangement, based on the longest increasing subsequence algorithm.
- **Minimum operation count**: Guarantees the minimum total number of move, create, and delete operations.

Core algorithm: Uses the longest increasing subsequence algorithm to find the largest set of items that don't need to be moved, then only performs move operations on the remaining items.

## 3. Fast Comparison Sub-algorithm

When any of the following conditions are met, glass-easel skips the full diff algorithm and uses the faster fast comparison sub-algorithm:

1. **`wx:key` is not specified**
2. **Only non-key fields are updated** (framework predicts this update does not involve list order changes)
3. **Only items are appended at the end** (framework predicts this update only adds to the list tail)

Fast comparison sub-algorithm logic:
- For the first `min(old.length, new.length)` items: Match and update one-to-one in order
- Extra old items: Remove sequentially
- Extra new items: Append to the end sequentially

Time complexity is O(N) with no move operations.

## 4. Performance Risks of Not Specifying wx:key

Not specifying `wx:key` triggers the fast comparison sub-algorithm, which assumes no item movement. If inserting or deleting items in the middle of the list:

- From the insertion/deletion point onward, all subsequent items are treated as "content changed" and updated one by one
- If list items contain components, components are not reused but forcefully updated with all properties
- For long lists, this causes a large number of unnecessary updates

Example: Inserting 1 item at the head of a 1000-item list — without key, all 1000 subsequent items are updated; with key, only 1 insert operation is needed.

## 5. Handling Duplicate Keys

When duplicate keys exist in the list:
- The framework generates warning messages
- Duplicate keys get different suffixes to distinguish them (e.g., `a--0`, `a--1`)
- This incurs additional processing overhead and should be avoided

## 6. Performance Characteristics for Common Scenarios

Performance test data based on glass-easel list diff algorithm (compared with existing MiniProgram algorithm):

| Scenario | Existing Algorithm | glass-easel | Description |
|---|---|---|---|
| No changes | 21.3ms | 11ms | Fast comparison path |
| Waterfall append | 76.0ms | 71.6ms | Tail append, fast comparison path |
| Scrolling comments (remove head, append tail) | 19.1ms | 15.0ms | Some items retained |
| Single item move | 95.6ms | 10.1ms | Longest increasing subsequence optimization is significant |
| Random move | 146.1ms | 130.0ms | Worst case O(NlogN) |

### Optimization Recommendations

- **Waterfall loading**: Appending items at the end; specifying or not specifying key makes little performance difference.
- **Scrolling comments**: Remove-head-append-tail pattern; specify key to reduce unnecessary component recreation.
- **Single item move** (e.g., pinning/drag sorting): Must specify key; glass-easel shows the most significant performance improvement in this scenario.
- **Random rearrangement**: Specify key; glass-easel guarantees minimum operation count.
