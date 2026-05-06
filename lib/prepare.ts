import type { PrepareFunction } from '@data-fair/lib-common-types/processings.js'
import type { ProcessingConfig } from '#types/processingConfig/index.ts'

/**
 * When the configuration is saved, we hide the secret values and store them in the secrets store.
 * - password and sshKey are extracted from connectionKey, stored in secrets, and replaced by '********'.
 * - If the field is emptied, the corresponding secret is removed.
 */
const prepare: PrepareFunction<ProcessingConfig> = async ({ processingConfig, secrets }) => {
  const connectionKey = processingConfig.connectionKey

  if (connectionKey.key === 'password') {
    const password = connectionKey.password
    if (password && password !== '********') {
      secrets.password = password
      connectionKey.password = '********'
    } else if (secrets.password && password === '') {
      delete secrets.password
    }
  }

  if (connectionKey.key === 'sshKey') {
    const sshKey = connectionKey.sshKey
    if (sshKey && sshKey !== '********') {
      secrets.sshKey = sshKey
      connectionKey.sshKey = '********'
    } else if (secrets.sshKey && sshKey === '') {
      delete secrets.sshKey
    }
  }

  return { processingConfig, secrets }
}

export default prepare
