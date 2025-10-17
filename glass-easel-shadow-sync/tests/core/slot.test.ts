import * as coreEnv from 'glass-easel/tests/base/env'
import { shadowSyncBackend } from '../base/env'

;(coreEnv as any).shadowBackend = shadowSyncBackend

require('../../../glass-easel/tests/legacy/slot.test')
require('../../../glass-easel/tests/core/slot.test')
