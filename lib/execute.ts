import type { ProcessingContext } from '@data-fair/lib-common-types/processings.js'
import type { ProcessingConfig } from '#types/processingConfig/index.ts'
import type { PluginConfig } from '#types/pluginConfig/index.ts'

import { open } from 'node:fs/promises'
import { promisify } from 'node:util'
import path from 'node:path'
import fs from 'fs-extra'
import FormData from 'form-data'
import { downloadFile, listFiles } from './fetch-utils.ts'
import datasetSchema from './dataset-schema.ts'
import process from './process.ts'

/**
 * Main processing execution function.
 * Downloads VertVolt files from FTP, processes XLSX files, and uploads to Data Fair.
 */
export const run = async (context: ProcessingContext<ProcessingConfig>): Promise<void> => {
  await context.log.step('Démarrage du traitement VertVolt')

  await download(context)      // Download files from FTP
  await process(context)   // Process XLSX files to CSV

  // Upload to Data Fair (unless skipUpload is true)
  if (!context.processingConfig.skipUpload) await upload(context)
  else await context.log.info('Upload ignoré (skipUpload = true)')
}

const download = async ({ pluginConfig, tmpDir, log }: ProcessingContext): Promise<void> => {
  const config = pluginConfig as PluginConfig
  if (!config.url) throw new Error('L\'URL du serveur FTP/SFTP doit être fournie dans la configuration du plugin')

  const parsed = new URL(config.url)
  const credentials = {
    username: config.username,
    password: config.password,
    privateKey: config.sshKey
  }

  const protocol = parsed.protocol.replace(':', '').toUpperCase()
  await log.step(`Téléchargement des fichiers depuis le serveur ${protocol}`)
  await log.info(`URL : ${config.url}`)

  await log.info(`Récupération de la liste des fichiers dans le répertoire ${parsed.pathname}`)

  const fileNames = await listFiles(config.url, credentials)

  await log.info(`${fileNames.length} fichier(s) trouvé(s)`)

  for (const file of fileNames) {
    const filePath = path.join(tmpDir, file)
    const exists = await fs.access(filePath).then(() => true).catch(() => false)

    if (!exists) {
      const fileUrl = new URL(config.url)
      fileUrl.pathname = path.posix.join(parsed.pathname, file)
      await log.info('Téléchargement du fichier ' + fileUrl.pathname)
      // creating empty file before streaming seems to fix some weird bugs with NFS
      await fs.writeFile(filePath + '.tmp', '')
      await downloadFile(fileUrl.toString(), credentials, filePath + '.tmp')

      // Try to prevent weird bug with NFS by forcing syncing file before reading it
      const fd = await open(filePath + '.tmp', 'r')
      await fd.sync()
      await fd.close()
      await fs.rename(filePath + '.tmp', filePath)
    } else {
      await log.debug('Lecture du fichier précédemment téléchargé ' + file)
    }
  }
}

const upload = async ({ processingConfig, processingId, tmpDir, axios, log, patchConfig }: ProcessingContext<ProcessingConfig>): Promise<void> => {
  const isUpdate = processingConfig.datasetMode === 'update'

  await log.step(isUpdate ? 'Mise à jour du jeu de données' : 'Création du jeu de données')

  const filePath = path.join(tmpDir, 'vertvolt.csv')
  const formData = new FormData()
  formData.append('dataset', fs.createReadStream(filePath))

  if (!isUpdate) {
    const body = {
      title: processingConfig.dataset.title || `VertVolt - ${new Date().toISOString()}`,
      schema: datasetSchema,
      extras: { processingId }
    }
    formData.append('body', JSON.stringify(body))
  }

  const contentLength = await promisify(formData.getLength.bind(formData))()

  const res = await axios({
    method: 'POST',
    url: `api/v1/datasets/${processingConfig.dataset.id}`,
    data: formData,
    headers: { ...formData.getHeaders(), 'Content-Length': contentLength }
  })

  const { id, title } = res.data.dataset
  await log.info(isUpdate
    ? `Jeu de donnée mis à jour, id="${id}", title="${title}"`
    : `Jeu de donnée créé, id="${id}", title="${title}"`
  )

  if (!isUpdate) {
    await patchConfig({ datasetMode: 'update', dataset: { id, title } })
  }
}
