const FTPClient = require('promise-ftp')
const fs = require('fs-extra')
const path = require('path')
const pump = require('pump')

module.exports = async (pluginConfig, tmpDir, log) => {
  await log.step('Connexion au serveur FTP')
  const ftp = new FTPClient()
  const serverMessage = await ftp.connect({
    ftpOptions: {
      host: 'localhost',
      port: 21,
      user: undefined,
      password: undefined,
      connTimeout: 30000,
      pasvTimeout: 30000,
      keepalive: 30000,
      autoReconnect: true
    },
    ...pluginConfig.ftpOptions
  })
  await log.info('connecté : ' + serverMessage)
  await log.step('Récupération des fichiers')
  await log.info('récupération de la liste des fichiers dans le répertoire ' + pluginConfig.folder)
  const files = await ftp.list(pluginConfig.folder)
  for (const file of files.map(f => f.name)) {
    const filePath = path.join(tmpDir, file)
    if (!await fs.pathExists(filePath)) {
      const ftpFilePath = path.join(pluginConfig.folder, file)
      await log.info('téléchargement du fichier ' + ftpFilePath)
      // creating empty file before streaming seems to fix some weird bugs with NFS
      await fs.ensureFile(filePath + '.tmp')
      await pump(await ftp.get(ftpFilePath), fs.createWriteStream(filePath + '.tmp'))
      // Try to prevent weird bug with NFS by forcing syncing file before reading it
      const fd = await fs.open(filePath + '.tmp', 'r')
      await fs.fsync(fd)
      await fs.close(fd)
      await fs.move(filePath + '.tmp', filePath)
    } else {
      await log.debug('lecture du fichier précédemment téléchargé ' + file)
    }
  }
}
