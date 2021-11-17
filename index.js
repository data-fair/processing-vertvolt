const download = require('./src/download')
const processData = require('./src/process')
const upload = require('./src/upload')

exports.run = async ({ pluginConfig, processingConfig, tmpDir, axios, log, patchConfig }) => {
  await download(pluginConfig, tmpDir, log)
  await processData(tmpDir, log)
  if (!processingConfig.skipUpload) await upload(processingConfig, tmpDir, axios, log, patchConfig)
}
