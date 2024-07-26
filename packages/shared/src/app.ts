import { merge } from 'lodash-es'

// @ts-expect-error
import { ensureFileSync, readJSONSync, writeJSONSync } from 'fs-extra/esm'
import { LOCAL_BOOK_DIR } from './constants'
import type { DB } from './data-source'
import { createDB } from './data-source'
import { ChapterHistory } from './controller/ChapterHistory'
import { ResourceHistory } from './controller/ResourceHistory'
import { ResourceFavorites } from './controller/ResourceFavorites'
import { ResourceRule } from './controller/ResourceRule'
import { RuleManager } from './controller/RuleManager'
import { Bookshelf } from './controller/Bookshelf'
import { Config } from './controller/Config'
import { TTS } from './controller/TTS'
import { mapRoute } from './decorators'

export interface App {
  db: DB
  config: any
  configPath: any
  controllers: any[]
  updateConfig: (data: any) => void
  readConfig: () => void
  useApi: (register: any) => void
}

export function createApp(params: { configPath: string; defaultConfig?: any; dataSourceOptions?: any }): App {
  const { dataSourceOptions } = params
  const defConfig = params.defaultConfig ?? {}

  const app: App = {
    db: createDB({
      dataSourceOptions,
    }),
    config: {},
    configPath: params.configPath,

    controllers: [
      ChapterHistory,
      ResourceHistory,
      ResourceFavorites,
      ResourceRule,
      RuleManager,
      Bookshelf,
      Config,
      TTS,
    ],

    updateConfig(data: any) {
      ensureFileSync(app.configPath)
      app.config = merge(app.config, data || {})
      writeJSONSync(app.configPath, app.config, { spaces: 2 })
    },

    readConfig() {
      ensureFileSync(app.configPath)
      let config = {}
      try {
        config = readJSONSync(app.configPath)
      }
      catch (error) {
        console.warn(error)
      }
      app.config = merge(defConfig, config)
      if (!app.config.bookDir)
        app.config.bookDir = LOCAL_BOOK_DIR
    },

    useApi(register: any) {
      runApp(app, register)
    },
  }

  app.readConfig()
  return app
}

async function runApp(app: App, register: any) {
  await app.db.initialize()

  for (const Controller of app.controllers) {
    const routes = mapRoute(Controller)
    for (const route of routes) {
      register([route.method.toLowerCase(), route.route].join('@'), async (...arg: any) => {
        const instance: any = new Controller(app)
        return await instance[route.methodName](...arg)
          .then((res: any) => success(res))
          .catch((res: Error) => success([], res?.message || 'error', -1))
      })
    }
  }
}

function success(data: any, msg = '', code = 0) {
  return {
    code,
    data,
    msg,
  }
}
