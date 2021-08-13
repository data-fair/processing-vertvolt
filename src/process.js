const XLSX = require('xlsx')
const fs = require('fs-extra')
const path = require('path')
const endOfLine = require('os').EOL
const datasetSchema = require('./schema.json')

module.exports = async (dir, log) => {
  const files = fs.readdirSync(dir)
  const dataWriteStream = fs.createWriteStream(path.join(dir, 'out.csv'))
  dataWriteStream.write(datasetSchema.map(f => `"${f.key}"`).join(',') + endOfLine)
  for (const file of files.filter(f => f !== 'out.csv')) {
    await log.info('\nTraitement du fichier :', file)
    const workbook = XLSX.readFile(path.join(dir, file))
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }).slice(2)
    const infos = data.shift()
    const base = {
      nom_fournisseur: infos[0],
      nom_offre: infos[1],
      niveau_labelisation: infos[2],
      statut_offre: infos[3],
      Recours_ARENH_fournisseur: infos[4],
      clients_offre_labelisee: infos[5],
      part_sans_soutien_public_offre: infos[6],
      part_gouvernance_partagee_offre: infos[7],
      couverture_demi_horaire_offre: infos[8],
      part_suivi_consommation_offre: infos[9]
    }
    data.splice(0, 6)
    const mwh = {}
    let technos = data.shift().slice(1, -1)
    let regions = data.splice(0, 13)
    for (const regData of regions) {
      const region = regData.shift()
      mwh[region] = {}
      for (let i = 0; i < technos.length; i++) {
        mwh[region][technos[i]] = { mwh_offre: regData[i] }
      }
    }
    data.splice(0, 7)
    technos = data.shift().slice(1, -1)
    regions = data.splice(0, 13)
    for (const regData of regions) {
      const region = regData.shift()
      for (let i = 0; i < technos.length; i++) {
        mwh[region][technos[i]].mwh_sans_soutien_public = regData[i]
      }
    }
    data.splice(0, 5)
    technos = data.shift().slice(1, -1)
    regions = data.splice(0, 13)
    for (const regData of regions) {
      const region = regData.shift()
      for (let i = 0; i < technos.length; i++) {
        mwh[region][technos[i]].mwh_gouvernance_partagee = regData[i]
      }
    }
    console.log(mwh)
    for (const [region, technos] of Object.entries(mwh)) {
      for (const [technologie, values] of Object.entries(technos)) {
        const fields = {
          region,
          technologie,
          ...values,
          ...base
        }
        dataWriteStream.write(datasetSchema.map(f => fields[f.key] ? `"${(fields[f.key] + '')}"` : '').join(';') + endOfLine)
      }
    }
  }
  dataWriteStream.end()
}
