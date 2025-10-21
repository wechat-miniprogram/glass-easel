import { StyleSegmentIndex } from 'glass-easel'

export default Component({
  properties: {
    hidden: Boolean,
  },
  data: {},
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
