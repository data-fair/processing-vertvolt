const FormData = require('form-data')
const path = require('path')
const fs = require('fs-extra')
const util = require('util')

function displayBytes (aSize) {
  aSize = Math.abs(parseInt(aSize, 10))
  if (aSize === 0) return '0 octets'
  const def = [[1, 'octets'], [1000, 'ko'], [1000 * 1000, 'Mo'], [1000 * 1000 * 1000, 'Go'], [1000 * 1000 * 1000 * 1000, 'To'], [1000 * 1000 * 1000 * 1000 * 1000, 'Po']]
  for (let i = 0; i < def.length; i++) {
    if (aSize < def[i][0]) return (aSize / def[i - 1][0]).toLocaleString() + ' ' + def[i - 1][1]
  }
}

module.exports = async (processingConfig, dir, axios, log, patchConfig) => {
  const datasetSchema = require('./schema.json')
  const formData = new FormData()
  const filePath = path.join(dir, 'out.csv')
  formData.append('file', fs.createReadStream(filePath), { filename: path.parse(filePath).base })

  if (processingConfig.datasetMode === 'create') {
    await log.step('Création du jeu de données')
    formData.append('schema', JSON.stringify(datasetSchema))
    formData.append('title', processingConfig.dataset.title)
    formData.getLength = util.promisify(formData.getLength)
    const contentLength = await formData.getLength()
    await log.info(`chargement de (${displayBytes(contentLength)})`)
    const dataset = (await axios.post('api/v1/datasets', formData)).data
    await log.info(`jeu de donnée créé, id="${dataset.id}", title="${dataset.title}"`)
    await patchConfig({ datasetMode: 'update', dataset: { id: dataset.id, title: dataset.title } })
  } else if (processingConfig.datasetMode === 'update') {
    await log.step('Vérification du jeu de données')
    formData.getLength = util.promisify(formData.getLength)
    const dataset = (await axios.post('api/v1/datasets/' + processingConfig.dataset.id, formData)).data
    await log.info(`jeu de donnée mis à jour, id="${dataset.id}", title="${dataset.title}"`)
  }
}
