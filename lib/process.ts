import type { ProcessingContext } from '@data-fair/lib-common-types/processings.js'

import XLSX from 'xlsx'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { EOL } from 'node:os'
import datasetSchema from './dataset-schema.ts'

export default async ({ tmpDir, log }: ProcessingContext): Promise<void> => {
  await log.step('Traitement des fichiers')

  const files = await fs.readdir(tmpDir)
  const outFile = await fs.open(path.join(tmpDir, 'vertvolt.csv'), 'w')
  await outFile.write(datasetSchema.map(f => `"${f.key}"`).join(',') + EOL)

  for (const file of files.filter(f => f !== 'vertvolt.csv')) {
    await log.info('Traitement du fichier : ' + file)
    const workbook = XLSX.readFile(path.join(tmpDir, file))
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 }).slice(2)
    const infos = data.shift()
    if (!infos) {
      await log.warning(`Fichier ${file} ignoré : pas de données d'information`)
      continue
    }
    const base = {
      nom_fournisseur: infos[0],
      nom_offre: infos[1],
      url_offre: data[0]?.[1],
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
    const mwh: Record<string, Record<string, any>> = {}
    let technos = data.shift()?.slice(1, -1) || []
    let regions = data.splice(0, 13)
    for (const regData of regions) {
      const region = regData.shift()
      if (!region) continue
      mwh[region] = {}
      for (let i = 0; i < technos.length; i++) {
        mwh[region][technos[i]] = { part_offre: regData[i] }
      }
    }
    data.splice(0, 7)
    technos = data.shift()?.slice(1, -1) || []
    regions = data.splice(0, 13)
    for (const regData of regions) {
      const region = regData.shift()
      if (!region) continue
      for (let i = 0; i < technos.length; i++) {
        mwh[region][technos[i]].part_sans_soutien_public = regData[i]
      }
    }
    data.splice(0, 5)
    technos = data.shift()?.slice(1, -1) || []
    regions = data.splice(0, 13)
    for (const regData of regions) {
      const region = regData.shift()
      if (!region) continue
      for (let i = 0; i < technos.length; i++) {
        mwh[region][technos[i]].part_gouvernance_partagee = regData[i]
      }
    }
    for (const [region, technos] of Object.entries(mwh)) {
      for (const [technologie, values] of Object.entries(technos)) {
        const fields: Record<string, any> = {
          region,
          technologie,
          ...values,
          ...base
        }
        await outFile.write(datasetSchema.map(f => (fields[f.key] !== null && fields[f.key] !== undefined) ? `"${String(fields[f.key])}"` : '').join(',') + EOL)
      }
    }
  }
  await outFile.close()
}
