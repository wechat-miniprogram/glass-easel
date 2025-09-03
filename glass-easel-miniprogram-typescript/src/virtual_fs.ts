import fs from 'node:fs/promises'
import path from 'node:path'
import chokidar, { type FSWatcher } from 'chokidar'

type VirtualFile = {
  version: number
  content: string | null
  overriddenContent: string | null
}

type VirtualDirectory = {
  version: number
  children: { [name: string]: VirtualFile | VirtualDirectory }
}

// determine if a path (relative to the code root) is a component
const isCompPath = async (rootPath: string, relPath: string): Promise<boolean> => {
  try {
    const json = await fs.readFile(path.join(rootPath, `${relPath}.json`), { encoding: 'utf8' })
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

class VirtualFileSystem {
  private rootPath: string
  private root: VirtualDirectory
  private watcher: FSWatcher

  constructor(rootPath: string, firstScanCallback: () => void) {
    this.rootPath = rootPath
    this.root = {
      version: 0,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      children: Object.create(null),
    }

    // file added handling
    const handleFileAdded = async (relPath: string) => {
      const extName = path.extname(relPath)
      if (extName === '.wxml') {
        if (await isCompPath(relPath.slice(0, -extName.length))) {
          this.onWxmlEntranceAdded(relPath)
        }
      }
    }

    // file removed handling
    const handleFileRemoved = async (relPath: string) => {
      const extName = path.extname(relPath)
      if (extName === '.wxml') {
        if (await isCompPath(relPath.slice(0, -extName.length))) {
          this.onWxmlEntranceRemoved(relPath)
        }
      }
    }

    // file changed handling
    const handleFileChanged = async (relPath: string) => {
      if (this.trackingWxml.includes(relPath)) {
        
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.watcher = chokidar.watch(rootPath, { ignoreInitial: false })
    this.watcher
      .on('add', (p) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        handleFileAdded(p)
      })
      .on('unlink', (p) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        handleFileRemoved(p)
      })
      .on('change', (p) => {
        // eslint-disable-next-line @typescript-eslint/no-floating-promises
        handleFileChanged(p)
      })
      .on('ready', () => {
        firstScanCallback()
      })
  }

  async stop() {
    await this.watcher.close()
  }

  private getFileEntry(relPath: string): VirtualFile | null {
    const parts = relPath.split('/')
    let curDir = this.root
    for (let i = 0; i < parts.length - 2; i += 1) {
      const part = parts[i]!
      if (!curDir.children[part] || !('children' in curDir.children[part])) {
        return null
      }
      const child = curDir.children[part]
      curDir = child
    }
    const name = parts[parts.length - 1]!
    if (curDir.children[name] && 'content' in curDir.children[name]) {
      return curDir.children[name] as VirtualFile
    }
    return null
  }

  private getOrCreateFileEntry(relPath: string): VirtualFile {
    const parts = relPath.split('/')
    let curDir = this.root
    for (let i = 0; i < parts.length - 2; i += 1) {
      const part = parts[i]!
      if (!curDir.children[part] || !('children' in curDir.children[part])) {
        curDir.children[part] = {
          version: 0,
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          children: Object.create(null),
        }
      }
      const child = curDir.children[part]
      curDir = child
    }
    const name = parts[parts.length - 1]!
    if (curDir.children[name] && 'content' in curDir.children[name]) {
      return curDir.children[name] as VirtualFile
    }
    curDir.children[name] = {
      version: 0,
      content: null,
      overriddenContent: null,
    }
    return curDir.children[name] as VirtualFile
  }

  private removeEntry(relPath: string) {
    const parts = relPath.split('/')
    let curDir = this.root
    const mid: [string, VirtualDirectory][] = []
    for (let i = 0; i < parts.length - 2; i += 1) {
      const part = parts[i]!
      if (!curDir.children[part] || !('children' in curDir.children[part])) {
        return
      }
      mid.push([part, curDir])
      const child = curDir.children[part]
      curDir = child
    }
    const name = parts[parts.length - 1]!
    delete curDir.children[name]
    while (mid.length > 0) {
      const [name, dir] = mid.pop()!
      if (Object.keys(dir.children).length === 0) {
        delete dir.children[name]
      }
    }
  }

  // Overrides the content of a file
  //
  // This also keep the file when the file is unlinked on dist.
  // The `relPath` should always be `/` seperated even on Windows.
  overrideFileContent(relPath: string, content: string) {
    const entry = this.getOrCreateFileEntry(relPath)
    entry.overriddenContent = content
  }

  // Cancels the overrides of a file
  //
  // The `relPath` should always be `/` seperated even on Windows.
  cancelOverrideFileContent(relPath: string) {
    const entry = this.getFileEntry(relPath)
    if (!entry) return
    if (entry.content === null) {
      this.removeEntry(relPath)
      return
    }
    entry.overriddenContent = null
  }
}
