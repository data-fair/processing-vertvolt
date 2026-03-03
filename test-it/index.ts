import config from '#config'
import { strict as assert } from 'node:assert'
import { it, describe } from 'node:test'
import testUtils from '@data-fair/lib-processing-dev/tests-utils.js'
import * as vertvoltPlugin from '../index.ts'

import pluginConfigSchema from '../plugin-config-schema.json' with { type: 'json' }
import processingConfigSchema from '../processing-config-schema.json' with { type: 'json' }

describe('VertVolt processing', () => {
  // Each plugin should expose a plugin config schema and a processing config schema
  it('should expose a plugin config schema for super admins', async () => {
    assert.equal(pluginConfigSchema.type, 'object')
  })

  it('should expose a processing config schema for users', async () => {
    assert.equal(processingConfigSchema.type, 'object')
  })

  // TODO
})
