import { strict as assert } from 'node:assert'
import { it, describe } from 'node:test'

import pluginConfigSchema from '../plugin-config-schema.json' with { type: 'json' }
import processingConfigSchema from '../processing-config-schema.json' with { type: 'json' }
import * as vertvoltPlugin from '../index.ts'

describe('VertVolt processing', () => {
  // Each plugin should expose a plugin config schema and a processing config schema
  it('should expose a plugin config schema for super admins', async () => {
    assert.equal(pluginConfigSchema.type, 'object')
  })

  it('should expose a processing config schema for users', async () => {
    assert.equal(processingConfigSchema.type, 'object')
  })

  it('should encrypt password in prepare', async () => {
    const processingConfig = {
      datasetMode: 'create' as const,
      dataset: { title: 'VertVolt test' },
      url: 'sftp://test.example.fr/ftp/Vertvolt',
      username: 'user',
      connectionKey: {
        key: 'password' as const,
        password: 'secret-password'
      }
    }

    const prepareRes = await vertvoltPlugin.prepare({ processingConfig, secrets: {} })
    assert.equal(prepareRes.processingConfig.connectionKey.password, '********')
    assert.equal(prepareRes.secrets.password, 'secret-password')
  })

  it('should encrypt sshKey in prepare', async () => {
    const processingConfig = {
      datasetMode: 'create' as const,
      dataset: { title: 'VertVolt test' },
      url: 'sftp://test.example.fr/ftp/Vertvolt',
      username: 'user',
      connectionKey: {
        key: 'sshKey' as const,
        sshKey: '-----BEGIN OPENSSH PRIVATE KEY-----\ntest-key\n-----END OPENSSH PRIVATE KEY-----'
      }
    }

    const prepareRes = await vertvoltPlugin.prepare({ processingConfig, secrets: {} })
    assert.equal(prepareRes.processingConfig.connectionKey.sshKey, '********')
    assert.equal(prepareRes.secrets.sshKey, '-----BEGIN OPENSSH PRIVATE KEY-----\ntest-key\n-----END OPENSSH PRIVATE KEY-----')
  })
})
