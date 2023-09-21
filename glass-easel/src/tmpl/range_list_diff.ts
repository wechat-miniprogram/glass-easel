import { Element, VirtualNode } from '..'
import { DataValue } from '../data_proxy'
import { UpdatePathTreeNode, UpdatePathTreeRoot } from './proc_gen_wrapper'
import { triggerWarning } from '../func_arr'

export class RangeListManager {
  keyName: string | null
  rawKeys!: string[]
  keyMap!: { [key: string]: number }
  sharedKeyMap!: { [key: string]: number[] } | undefined
  items!: DataValue[]
  indexes!: (string | number)[] | null

  constructor(
    keyName: string | null,
    dataList: DataValue,
    elem: Element,
    newListItem: (item: DataValue, index: number | string) => VirtualNode,
  ) {
    this.keyName = keyName
    this.updateKeys(dataList)
    const items = this.items
    const indexes = this.indexes
    const children: VirtualNode[] = []
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i]!
      const index = indexes === null ? i : indexes[i]!
      children.push(newListItem(item, index))
    }
    elem.insertChildren(children, -1)
  }

  updateKeys(dataList: DataValue) {
    // collect the list depending on the the type of the data list
    let items: DataValue[]
    let indexes: (string | number)[] | null
    if (Array.isArray(dataList)) {
      items = dataList
      indexes = null
    } else if (typeof dataList === 'object' && dataList !== null) {
      const k = Object.keys(dataList)
      items = new Array<DataValue>(k.length)
      indexes = new Array<string>(k.length)
      for (let i = 0; i < k.length; i += 1) {
        const key = k[i]!
        const item = (dataList as { [key: string]: unknown })[key]
        items[i] = item
        indexes[i] = key
      }
    } else if (typeof dataList === 'string') {
      triggerWarning(
        'Use string as for-list is generally for testing. Each character is treated as an item.',
      )
      items = new Array<string>(dataList.length)
      indexes = null
      for (let i = 0; i < dataList.length; i += 1) {
        items[i] = dataList[i]!
      }
    } else if (typeof dataList === 'number') {
      triggerWarning(
        'Use number as for-list is generally for testing. The number is used as the repeated times of the item.',
      )
      items = new Array<string>(dataList)
      indexes = null
      for (let i = 0; i < dataList; i += 1) {
        items[i] = i
      }
    } else {
      triggerWarning('The for-list data is invalid. Use empty array instead.')
      items = []
      indexes = null
    }
    this.items = items
    this.indexes = indexes

    // generate keys and key indexes map for the list
    const keyName = this.keyName
    const rawKeys = new Array<string>(items.length)
    const keyMap = Object.create(null) as { [key: string]: number }
    let sharedKeyMap: { [key: string]: number[] } | undefined
    if (keyName !== null) {
      // firstly, find all unique keys and shared keys
      for (let i = 0; i < items.length; i += 1) {
        const item = items[i]! as { [k: string]: unknown } | undefined
        const rawKeyField = keyName === '*this' ? item : item?.[keyName]
        const rawKey = rawKeyField !== undefined && rawKeyField !== null ? String(rawKeyField) : ''
        rawKeys[i] = rawKey
        if (keyMap[rawKey] !== undefined) {
          if (!sharedKeyMap) {
            sharedKeyMap = Object.create(null) as { [key: string]: number[] }
          }
          sharedKeyMap[rawKey] = [keyMap[rawKey]!, i]
          delete keyMap[rawKey]
        } else if (sharedKeyMap?.[rawKey]) {
          sharedKeyMap[rawKey]!.push(i)
        } else {
          keyMap[rawKey] = i
        }
      }
      // convert shared keys to unique keys
      if (sharedKeyMap) {
        const keys = Object.keys(sharedKeyMap)
        triggerWarning(`Some keys are not unique while list updates: "${keys.join('", "')}".`)
        for (let i = 0; i < keys.length; i += 1) {
          const key = keys[i]!
          const items = sharedKeyMap[key]!
          let inc = 0
          for (let j = 0; j < items.length; j += 1) {
            const index = items[j]!
            while (keyMap[`${key}--${inc}`] !== undefined) inc += 1
            const k = `${key}--${inc}`
            keyMap[k] = index
            rawKeys[index] = k
          }
        }
      }
    }
    this.rawKeys = rawKeys
    this.keyMap = keyMap
    this.sharedKeyMap = sharedKeyMap
  }

  diff(
    dataList: DataValue[],
    oriUpdatePathTree: UpdatePathTreeRoot,
    elem: Element,
    newListItem: (item: DataValue, index: string | number) => VirtualNode,
    updateListItem: (
      item: DataValue,
      index: string | number,
      updatePathTree: UpdatePathTreeRoot,
      indexChanged: boolean,
      node: VirtualNode,
    ) => void,
  ) {
    // generate new list for comparison
    const oldRawKeys = this.rawKeys
    const oldKeyMap = this.keyMap
    const oldSharedKeyMap = this.sharedKeyMap
    const oldIndexes = this.indexes
    this.updateKeys(dataList)
    const newRawKeys = this.rawKeys
    const newSharedKeyMap = this.sharedKeyMap
    const items = this.items
    const indexes = this.indexes
    const keyName = this.keyName

    // transform the update path tree if needed:
    // if the list has been splice-updated, or a key is updated,
    // all items with old-list shared keys or new-list shared keys should be marked;
    // and items with key updates should be marked
    let allowFastComparison: boolean
    let updatePathTree: UpdatePathTreeRoot
    if (oriUpdatePathTree === true) {
      updatePathTree = true
      allowFastComparison = keyName === null
    } else if (oriUpdatePathTree === undefined) {
      updatePathTree = oriUpdatePathTree
      allowFastComparison = true
    } else if (keyName === null) {
      updatePathTree = true
      allowFastComparison = true
    } else {
      let needUpdate = false
      if (Array.isArray(oriUpdatePathTree)) {
        needUpdate = true
      } else {
        const keys = Object.keys(oriUpdatePathTree)
        for (let i = 0; i < keys.length; i += 1) {
          const k = keys[i]!
          const subTree = (oriUpdatePathTree as { [s: string]: UpdatePathTreeNode })[k]! as
            | { [s: string]: UpdatePathTreeNode }
            | undefined
            | true
          if (subTree === true || (keyName === '*this' ? subTree : subTree?.[keyName])) {
            needUpdate = true
            break
          }
        }
      }
      if (needUpdate) {
        updatePathTree = new Array(newRawKeys.length)
        for (let i = 0; i < newRawKeys.length; i += 1) {
          const k = newRawKeys[i]!
          if (oldSharedKeyMap?.[k] !== undefined || newSharedKeyMap?.[k] !== undefined) {
            updatePathTree[i] = true
          } else {
            const subTree = (oriUpdatePathTree as { [s: string]: UpdatePathTreeNode })[i] as
              | { [s: string]: UpdatePathTreeNode }
              | undefined
              | true
            if (subTree === undefined) {
              // empty
            } else if (subTree === true || (keyName === '*this' ? subTree : subTree?.[keyName])) {
              updatePathTree[i] = true
            } else {
              updatePathTree[i] = subTree
            }
          }
        }
        allowFastComparison = false
      } else {
        updatePathTree = oriUpdatePathTree
        allowFastComparison = false
      }
    }

    // if there is no key, or nothing in the old list range is updated
    if (allowFastComparison) {
      // transform the update path tree if needed:
      // if the list has been splice-updated, then mark the whole list
      let updatePathTree: UpdatePathTreeRoot
      if (Array.isArray(oriUpdatePathTree)) updatePathTree = true
      else updatePathTree = oriUpdatePathTree

      // simply match them one-by-one
      let i = 0
      while (i < oldRawKeys.length && i < newRawKeys.length) {
        const item = items[i]!
        const index = indexes === null ? i : indexes[i]!
        const oldIndex = oldIndexes === null ? i : oldIndexes[i]!
        const u =
          updatePathTree === true || updatePathTree === undefined
            ? updatePathTree
            : updatePathTree[i]
        updateListItem(item, index, u, index !== oldIndex, elem.childNodes[i]! as VirtualNode)
        i += 1
      }

      // if the old list has extra items, remove them;
      // if the new list has extra items, append them
      if (i < oldRawKeys.length) {
        elem.removeChildren(i, oldRawKeys.length - i)
      } else if (i < newRawKeys.length) {
        const children: VirtualNode[] = []
        for (; i < newRawKeys.length; i += 1) {
          const item = items[i]!
          const index = indexes === null ? i : indexes[i]!
          children.push(newListItem(item, index))
        }
        elem.insertChildren(children, -1)
      }

      return
    }

    // in order to find out which nodes are stable (a.k.a. not needed to be moved),
    // here uses a classic LCS (longest-common-subsequence) algorithm for list with distinct items,
    // which is O(N*logN) at worst
    // (the `minIndexByLen[i]` is the minimum old-list index when LCS length is `i` )
    const minIndexByLen: number[] = []
    const minIndexByLenIndexes: number[] = []
    const minIndexPrev = new Array<number>(newRawKeys.length)
    const oldPosList = new Array<number>(newRawKeys.length)
    let prevOldIndex = -1
    let prevMinIndexByLenIndex = -1
    for (let i = 0; i < newRawKeys.length; i += 1) {
      const rawKey = newRawKeys[i]!

      // the new-list current item is likely to be the same as the one in old-list;
      // if that, simply use it -
      // this will help to decrease the overhead in common cases (O(N) in best case)
      if (oldRawKeys[prevOldIndex + 1] === rawKey) {
        prevOldIndex += 1
        prevMinIndexByLenIndex += 1
        minIndexByLen[prevMinIndexByLenIndex] = prevOldIndex
        minIndexByLenIndexes[prevMinIndexByLenIndex] = i
        minIndexPrev[i] =
          prevMinIndexByLenIndex > 0 ? minIndexByLenIndexes[prevMinIndexByLenIndex - 1]! : -1
        oldPosList[i] = prevOldIndex
        continue
      }

      // Skip new items
      const oldIndex = oldKeyMap[rawKey]
      if (oldIndex === undefined) {
        oldPosList[i] = -1
        continue
      }

      // find the old-list index for the key of the current item
      let bottom = 0
      let top = minIndexByLen.length
      while (bottom < top) {
        const mid = Math.floor((bottom + top) / 2)
        if (oldIndex < minIndexByLen[mid]!) top = mid
        else bottom = mid + 1
      }
      minIndexByLen[top] = oldIndex
      minIndexByLenIndexes[top] = i
      minIndexPrev[i] = top > 0 ? minIndexByLenIndexes[top - 1]! : -1
      oldPosList[i] = oldIndex
      prevOldIndex = oldIndex
      prevMinIndexByLenIndex = top
    }
    const lcsLen = minIndexByLenIndexes.length

    // if LCS is the whole list, then the list is not changed -
    // simply match each item one-by-one
    if (lcsLen === newRawKeys.length && lcsLen === oldRawKeys.length) {
      let i = 0
      while (i < oldRawKeys.length && i < newRawKeys.length) {
        const item = items[i]!
        const index = indexes === null ? i : indexes[i]!
        const oldIndex = oldIndexes === null ? i : oldIndexes[i]!
        const u: UpdatePathTreeRoot =
          updatePathTree === true || updatePathTree === undefined
            ? updatePathTree
            : (updatePathTree as UpdatePathTreeNode[])[i]
        updateListItem(item, index, u, index !== oldIndex, elem.childNodes[i]! as VirtualNode)
        i += 1
      }
      return
    }

    // search the unused `minIndexPrev` items to get the LCS item list
    // ( `minIndexByLen` is reused as the LCS array, since they must have the same length)
    let prevLcsIndex = lcsLen > 0 ? minIndexByLenIndexes[lcsLen - 1]! : -1
    let curLcsArrIndex = lcsLen
    while (prevLcsIndex !== -1) {
      curLcsArrIndex -= 1
      minIndexByLen[curLcsArrIndex] = prevLcsIndex
      prevLcsIndex = minIndexPrev[prevLcsIndex]!
    }
    const lcsArr = minIndexByLen

    // decide what operation to be used with each item
    const enum OpKind {
      Stable = 0,
      ForwardMove, // move towards the array end (index increasing direction)
      BackwardMove, // move towards the array start (index decreasing direction)
    }
    const oldListOp = new Array(oldRawKeys.length) as (OpKind | undefined)[]
    const changedItems = new Array(newRawKeys.length) as (VirtualNode | undefined)[]
    let prevLcsOldPos = -1
    for (let i = 0; i < oldPosList.length; i += 1) {
      const oldPos = oldPosList[i]!
      if (i === lcsArr[curLcsArrIndex]) {
        prevLcsOldPos = oldPos
        curLcsArrIndex += 1
        oldListOp[oldPos] = OpKind.Stable
        continue
      }
      if (oldPos === -1) {
        const item = items[i]!
        const index = indexes === null ? i : indexes[i]!
        changedItems[i] = newListItem(item, index)
        continue
      }
      if (oldPos > prevLcsOldPos) {
        oldListOp[oldPos] = OpKind.BackwardMove
      } else {
        oldListOp[oldPos] = OpKind.ForwardMove
      }
      changedItems[i] = elem.childNodes[oldPos] as VirtualNode
    }

    // visit the op list again and do the operations one-by-one
    let realListDiff = 0
    let opOldPos = 0
    let opIndex = 0
    curLcsArrIndex = 0
    do {
      const nextStable =
        curLcsArrIndex < lcsArr.length ? lcsArr[curLcsArrIndex]! : changedItems.length
      const nextStableOldPos =
        curLcsArrIndex < lcsArr.length ? oldPosList[nextStable]! : oldListOp.length

      // remove items between two LCS items
      while (opOldPos < nextStableOldPos) {
        if (oldListOp[opOldPos] === undefined) {
          const start = opOldPos
          opOldPos += 1
          let count = 1
          while (opOldPos < nextStableOldPos && oldListOp[opOldPos] === undefined) {
            opOldPos += 1
            count += 1
          }
          elem.removeChildren(start + realListDiff, count)
          realListDiff -= count
        } else {
          if (oldListOp[opOldPos] === OpKind.BackwardMove) {
            realListDiff -= 1
          }
          opOldPos += 1
        }
      }

      // insert or move items between two LCS items
      while (opIndex < nextStable) {
        const newItem = changedItems[opIndex]!
        const oldPos = oldPosList[opIndex]!
        if (oldPos === -1) {
          const start = opIndex
          opIndex += 1
          let count = 1
          while (opIndex < nextStable && oldPosList[opIndex] === -1) {
            opIndex += 1
            count += 1
          }
          elem.insertChildren(
            changedItems.slice(start, start + count) as VirtualNode[],
            nextStableOldPos + realListDiff,
          )
          realListDiff += count
        } else {
          elem.insertChildAt(newItem, nextStableOldPos + realListDiff)
          const item = items[opIndex]!
          const index = indexes === null ? opIndex : indexes[opIndex]!
          const oldIndex = oldIndexes === null ? oldPos : oldIndexes[oldPos]!
          const u: UpdatePathTreeRoot =
            updatePathTree === true || updatePathTree === undefined
              ? updatePathTree
              : (updatePathTree as UpdatePathTreeNode[])[opIndex]
          updateListItem(item, index, u, index !== oldIndex, newItem)
          if (oldListOp[oldPos] === OpKind.BackwardMove) {
            realListDiff += 1
          }
          opIndex += 1
        }
      }

      // stable items might be marked and indexes in stable positions might change;
      // if that, do an update
      // IDEA do not update if {{index}} is not used in template
      if (curLcsArrIndex < lcsArr.length) {
        const item = items[nextStable]!
        const index = indexes === null ? nextStable : indexes[nextStable]!
        const oldIndex = oldIndexes === null ? nextStableOldPos : oldIndexes[nextStableOldPos]!
        const u: UpdatePathTreeRoot =
          updatePathTree === true || updatePathTree === undefined
            ? updatePathTree
            : (updatePathTree as UpdatePathTreeNode[])[nextStable]
        const node = elem.childNodes[nextStableOldPos + realListDiff]! as VirtualNode
        updateListItem(item, index, u, index !== oldIndex, node)
      }

      opOldPos = nextStableOldPos + 1
      opIndex = nextStable + 1
      curLcsArrIndex += 1
    } while (curLcsArrIndex <= lcsArr.length)
  }
}
