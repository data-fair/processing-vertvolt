import type { ProcessingContext } from '@data-fair/lib-common-types/processings.js'
import type { PluginConfig } from '#types/pluginConfig/index.ts'

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { downloadFileFTP, downloadFileSFTP, listFilesFTP, listFilesSFTP } from './fetch-utils.ts'

export default async ({ pluginConfig, tmpDir, log }: ProcessingContext): Promise<void> => {
  const config = pluginConfig as PluginConfig;

  const isSftp = config.protocol === 'sftp'
  const folder = config.folder ?? '/ftp/Vertvolt'

  const connection = {
    host: config.host,
    port: config.port ?? (isSftp ? 22 : 21),
    username: config.username,
    password: config.password,
    privateKey: config.sshKey
  }

  await log.step(`Téléchargement des fichiers depuis le serveur ${config.protocol.toUpperCase()}`)
  await log.info(`Hôte : ${connection.host}:${connection.port}, Répertoire : ${folder}`)

  await log.info(`Récupération de la liste des fichiers dans le répertoire ${folder}`)

  const fileNames = await (isSftp ? listFilesSFTP : listFilesFTP)(connection, folder)

  await log.info(`${fileNames.length} fichier(s) trouvé(s)`)

  for (const file of fileNames) {
    const filePath = path.join(tmpDir, file)
    const exists = await fs.access(filePath).then(() => true).catch(() => false)

    if (!exists) {
      const remotePath = path.posix.join(folder, file)
      await log.info('Téléchargement du fichier ' + remotePath)
      // creating empty file before streaming seems to fix some weird bugs with NFS
      await fs.writeFile(filePath + '.tmp', '')
      await (isSftp ? downloadFileSFTP : downloadFileFTP)(connection, remotePath, filePath + '.tmp')

      // Try to prevent weird bug with NFS by forcing syncing file before reading it
      const fd = await fs.open(filePath + '.tmp', 'r')
      await fd.sync()
      await fd.close()
      await fs.rename(filePath + '.tmp', filePath)
    } else {
      await log.debug('Lecture du fichier précédemment téléchargé ' + file)
    }
  }
}

