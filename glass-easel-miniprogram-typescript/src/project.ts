import fs from 'node:fs'
import path from 'node:path'
import { TmplGroup } from 'glass-easel-template-compiler'
import { VirtualFileSystem } from './virtual_fs'

// determine if a path (relative to the code root) is a component
const isCompPath = (fullPath: string): boolean => {
  try {
    const json = fs.readFileSync(`${fullPath}.json`, { encoding: 'utf8' })
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
  private tmplGroup = new TmplGroup()
  private entranceFiles = Object.create(null) as Record<string, true>
  onTrackedFileRemoved: (fullPath: string) => void = () => {}
  onTrackedFileUpdated: (fullPath: string) => void = () => {}

  constructor(rootPath: string, autoTrackAllComponents: boolean, firstScanCallback: () => void) {
    this.vfs = new VirtualFileSystem(rootPath, firstScanCallback)
    this.vfs.onFileFound = (fullPath) => {
      if (!autoTrackAllComponents) return
      const extName = path.extname(fullPath)
      if (extName === '.wxml') {
        if (isCompPath(fullPath.slice(0, -extName.length))) {
          this.vfs.trackFile(fullPath)
          this.entranceFiles[fullPath] = true
        }
      }
    }
    this.vfs.onTrackedFileUpdated = (fullPath) => {
      this.onTrackedFileUpdated(fullPath)
    }
    this.vfs.onTrackedFileRemoved = (fullPath) => {
      this.onTrackedFileRemoved(fullPath)
    }
  }

  stop() {
    this.tmplGroup.free()
    return this.vfs.stop()
  }

  getEntranceFiles() {
    return Object.keys(this.entranceFiles)
  }

  getFileContent(fullPath: string): string | null {
    return this.vfs.trackFile(fullPath)?.content ?? null
  }

  getFileVersion(fullPath: string): number | null {
    return this.vfs.trackFile(fullPath)?.version ?? null
  }

  openFile(fullPath: string, content: string) {
    const extName = path.extname(fullPath)
    if (extName === '.wxml') {
      this.vfs.overrideFileContent(fullPath, content)
      this.entranceFiles[fullPath] = true
    }
  }

  updateFile(fullPath: string, content: string) {
    if (this.entranceFiles[fullPath]) {
      this.vfs.overrideFileContent(fullPath, content)
    }
  }

  closeFile(fullPath: string) {
    if (this.entranceFiles[fullPath]) {
      delete this.entranceFiles[fullPath]
      this.vfs.cancelOverrideFileContent(fullPath)
    }
  }
}
