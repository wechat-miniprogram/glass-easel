import { StyleSegmentIndex } from 'glass-easel'

Component({
  properties: {
    hidden: Boolean,
  },
  observers: {
    hidden(hidden: boolean) {
      // `this._$` is the underlying glass-easel element
      // (this cannot be retrieved in MiniProgram environment)
      const glassEaselElement = this._$
      if (hidden) {
        glassEaselElement.setNodeStyle('display: none', StyleSegmentIndex.TEMP_EXTRA)
      } else {
        glassEaselElement.setNodeStyle('', StyleSegmentIndex.TEMP_EXTRA)
      }
    },
  },
})
