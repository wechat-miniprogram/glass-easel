import * as coreEnv from 'glass-easel/tests/base/env'
import { shadowDomBackend } from '../base/env'

;(coreEnv as any).shadowBackend = shadowDomBackend

require('../../../glass-easel/tests/legacy/slot.test')
require('../../../glass-easel/tests/core/slot.test')
