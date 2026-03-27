import { createApp, createStore } from '../src/app.js'

const store = globalThis.__portfolioCmsStore || (globalThis.__portfolioCmsStore = createStore())
const app = createApp(store)

export default app
