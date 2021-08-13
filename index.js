const fs = require('fs-extra')
const download = require('./src/download')
const processData = require('./src/process')
const update = require('./src/update')

exports.run = async ({ pluginConfig, processingConfig, dir, axios, log, patchConfig }) => {
  // await download(pluginConfig, dir, log)
  await processData(dir, log)
  // if (!processingConfig.skipUpload) await update(processingConfig, dir, axios, log, patchConfig)
  // if (processingConfig.clearFiles) await fs.emptyDir(dir)
}
