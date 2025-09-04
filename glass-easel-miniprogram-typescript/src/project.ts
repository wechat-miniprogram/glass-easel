import fs from 'node:fs'
import path from 'node:path'
import { VirtualFileSystem } from './virtual_fs'

// determine if a path (relative to the code root) is a component
const isCompPath = (rootPath: string, relPath: string): boolean => {
  try {
    const json = fs.readFileSync(path.join(rootPath, `${relPath}.json`), { encoding: 'utf8' })
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const parsed = JSON.parse(json)
    if (
      typeof parsed === 'object' &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      (parsed.component === true || typeof parsed.usingComponents === 'object')
    ) {
      return true
    }
  } catch (e) {
    /* empty */
  }
  return false
}

export class ProjectDirManager {
  readonly vfs: VirtualFileSystem
  onTrackedFileRemoved: (relPath: string) => void = () => {}
  onTrackedFileUpdated: (relPath: string) => void = () => {}

  constructor(rootPath: string, autoTrackAllComponents: boolean, firstScanCallback: () => void) {
    this.vfs = new VirtualFileSystem(rootPath, firstScanCallback)
    this.vfs.onFileFound = (relPath) => {
      if (!autoTrackAllComponents) return
      const extName = path.extname(relPath)
      if (extName === '.wxml') {
        if (isCompPath(rootPath, relPath.slice(0, -extName.length))) {
          this.vfs.trackFileContent(relPath)
        }
      }
    }
    this.vfs.onTrackedFileUpdated = (relPath) => {
      this.onTrackedFileUpdated(relPath)
    }
    this.vfs.onTrackedFileRemoved = (relPath) => {
      this.onTrackedFileRemoved(relPath)
    }
  }

  stop() {
    return this.vfs.stop()
  }
}
