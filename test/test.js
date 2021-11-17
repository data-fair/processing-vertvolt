process.env.NODE_ENV = 'test'
const fs = require('fs-extra')
const config = require('config')
const axios = require('axios')
const chalk = require('chalk')
const moment = require('moment')
const assert = require('assert').strict
const processing = require('../')

describe('VertVolt processing', () => {
  it('should expose a processing config schema for users', async () => {
    const schema = require('../processing-config-schema.json')
    assert.equal(schema.type, 'object')
  })

  it('should run a task', async function () {
    this.timeout(3600000)

    const headers = { 'x-apiKey': config.dataFairAPIKey }
    const axiosInstance = axios.create({
      // baseURL: config.dataFairUrl,
      // headers,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })
    // apply default base url and send api key when relevant
    axiosInstance.interceptors.request.use(cfg => {
      if (!/^https?:\/\//i.test(cfg.url)) {
        if (cfg.url.startsWith('/')) cfg.url = config.dataFairUrl + cfg.url
        else cfg.url = config.dataFairUrl + '/' + cfg.url
      }
      if (cfg.url.startsWith(config.dataFairUrl)) Object.assign(cfg.headers, headers)
      return cfg
    }, error => Promise.reject(error))

    // customize axios errors for shorter stack traces when a request fails
    axiosInstance.interceptors.response.use(response => response, error => {
      if (!error.response) return Promise.reject(error)
      delete error.response.request
      error.response.config = { method: error.response.config.method, url: error.response.config.url, data: error.response.config.data }
      return Promise.reject(error.response)
    })

    await fs.ensureDir('data/tmp')
    // await fs.emptyDir('data/tmp')
    await processing.run({
      pluginConfig: config.pluginConfig,
      processingConfig: {
        skipUpload: false,
        datasetMode: 'create',
        dataset: {
          title: 'vertvolt - test'
        }
      },
      tmpDir: 'data/tmp',
      axios: axiosInstance,
      log: {
        step: (msg) => console.log(chalk.blue.bold.underline(`[${moment().format('LTS')}] ${msg}`)),
        error: (msg, extra) => console.log(chalk.red.bold(`[${moment().format('LTS')}] ${msg}`), extra),
        warning: (msg, extra) => console.log(chalk.red(`[${moment().format('LTS')}] ${msg}`), extra),
        info: (msg, extra) => console.log(chalk.blue(`[${moment().format('LTS')}] ${msg}`), extra),
        debug: (msg, extra) => {
          console.log(`[${moment().format('LTS')}] ${msg}`, extra)
        }
      },
      patchConfig: async (patch) => {
        console.log('received config patch', patch)
      }
    })
  })
})
