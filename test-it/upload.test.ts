import { strict as assert } from 'node:assert'
import { after, it, describe } from 'node:test'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { upload } from '../lib/execute.ts'

const log = {
  step: async () => {},
  task: async () => {},
  progress: async () => {},
  info: async () => {},
  debug: async () => {},
  warning: async () => {},
  error: async () => {}
}

const tmpDirs: string[] = []

const makeTmpDir = async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'vertvolt-upload-'))
  tmpDirs.push(dir)
  await writeFile(path.join(dir, 'vertvolt.csv'), '"nom_fournisseur"\n"test"\n')
  return dir
}

after(async () => {
  for (const dir of tmpDirs) await rm(dir, { recursive: true, force: true })
})

const runUpload = async (processingConfig: any) => {
  const calls: any[] = []
  const patches: any[] = []
  const axios = async (config: any) => {
    calls.push(config)
    return { data: { id: 'df-generated-id', title: 'VertVolt' } }
  }
  const patchConfig = async (patch: any) => { patches.push(patch) }
  await upload({ processingConfig, processingId: 'processing-1', tmpDir: await makeTmpDir(), axios, log, patchConfig } as any)
  return { calls, patches }
}

describe('VertVolt upload', () => {
  it('should let data-fair generate the id when creating a dataset', async () => {
    const { calls, patches } = await runUpload({
      datasetMode: 'create',
      dataset: { title: 'VertVolt' }
    })

    assert.equal(calls.length, 1)
    assert.equal(calls[0].method, 'POST')
    assert.equal(calls[0].url, 'api/v1/datasets')
    assert.deepEqual(patches, [{ datasetMode: 'update', dataset: { id: 'df-generated-id', title: 'VertVolt' } }])
  })

  it('should upload to the configured dataset when updating', async () => {
    const { calls, patches } = await runUpload({
      datasetMode: 'update',
      dataset: { id: 'existing-dataset-id', title: 'VertVolt' }
    })

    assert.equal(calls.length, 1)
    assert.equal(calls[0].method, 'POST')
    assert.equal(calls[0].url, 'api/v1/datasets/existing-dataset-id')
    assert.deepEqual(patches, [])
  })

  it('should refuse to update without a dataset id', async () => {
    let called = false
    const axios = async () => {
      called = true
      return { data: {} }
    }

    await assert.rejects(
      upload({
        processingConfig: { datasetMode: 'update', dataset: {} },
        processingId: 'processing-1',
        tmpDir: await makeTmpDir(),
        axios,
        log,
        patchConfig: async () => {}
      } as any),
      /identifiant manquant/
    )
    assert.equal(called, false)
  })
})
