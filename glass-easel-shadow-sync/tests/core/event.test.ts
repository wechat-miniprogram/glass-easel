import * as coreEnv from 'glass-easel/tests/base/env'
import { shadowSyncBackend } from '../base/env'

;(coreEnv as any).shadowBackend = shadowSyncBackend

require('../../../glass-easel/tests/tmpl/event.test')
