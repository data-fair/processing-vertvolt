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
    // Bloc 1 : part_offre
    data.splice(0, 6)
    const headerRow = data.shift() || []
    const totalIdx = headerRow.indexOf('Total')
    const technos: string[] = totalIdx > 0 ? headerRow.slice(1, totalIdx) : headerRow.slice(1, -1)
    const block1 = data.splice(0, 13)
    // Bloc 2 : part_sans_soutien_public
    data.splice(0, 7)
    data.shift()
    const block2 = data.splice(0, 13)
    // Bloc 3 : part_gouvernance_partagee
    data.splice(0, 5)
    data.shift()
    const block3 = data.splice(0, 13)

    // Les 3 blocs alignent toujours les 13 mêmes régions dans le même ordre.
    // On indexe par position pour résister aux variations de libellé entre blocs
    // (un fichier ENGIE 2024 contient une annotation parasite sur le nom de région
    // du bloc 1 qui n'est pas reprise dans les blocs 2 et 3).
    const mwh: Record<string, Record<string, any>> = {}
    for (let r = 0; r < block1.length; r++) {
      const regRow1 = block1[r]
      const region = regRow1?.[0]
      if (!region) continue
      mwh[region] = {}
      const regRow2 = block2[r] || []
      const regRow3 = block3[r] || []
      for (let i = 0; i < technos.length; i++) {
        mwh[region][technos[i]] = {
          part_offre: regRow1[i + 1],
          part_sans_soutien_public: regRow2[i + 1],
          part_gouvernance_partagee: regRow3[i + 1]
        }
      }
    }

    for (const [region, technosMap] of Object.entries(mwh)) {
      for (const [technologie, values] of Object.entries(technosMap)) {
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
