/* eslint-disable no-new-func */
/* eslint-disable @typescript-eslint/no-implied-eval */

import * as glassEasel from 'glass-easel'
import { TmplGroup } from 'glass-easel-template-compiler'

export const tmpl = (src: string): glassEasel.template.ComponentTemplate => {
  const group = new TmplGroup()
  group.addTmpl('', src)
  const genObjectSrc = `return ${group.getTmplGenObjectGroups()}`
  group.free()
  // console.info(genObjectSrc)
  const genObjectGroupList = new Function(genObjectSrc)() as { [key: string]: any }
  return {
    groupList: genObjectGroupList,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    content: genObjectGroupList['']!,
  }
}
