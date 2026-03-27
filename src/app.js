import { randomUUID } from 'node:crypto'

export function createStore() {
  return {
    sessions: new Set(),
    projects: [],
    posts: [],
  }
}

export function loginAdmin(store, { email, password }, credentials) {
  if (email !== credentials.email || password !== credentials.password) {
    throw new Error('credenciais admin invalidas')
  }

  const token = randomUUID()
  store.sessions.add(token)
  return { token }
}

function assertAdmin(store, token) {
  if (!store.sessions.has(token)) {
    throw new Error('acesso admin negado')
  }
}

export function createProject(store, token, payload) {
  assertAdmin(store, token)

  const title = String(payload.title || '').trim()
  if (!title) {
    throw new Error('title e obrigatorio')
  }

  const project = {
    id: randomUUID(),
    title,
    summary: String(payload.summary || '').trim(),
    tech: Array.isArray(payload.tech) ? payload.tech : [],
    published: Boolean(payload.published),
    createdAt: new Date().toISOString(),
  }

  store.projects.push(project)
  return project
}

export function createPost(store, token, payload) {
  assertAdmin(store, token)

  const title = String(payload.title || '').trim()
  const content = String(payload.content || '').trim()
  if (!title || !content) {
    throw new Error('title e content sao obrigatorios')
  }

  const post = {
    id: randomUUID(),
    title,
    content,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    published: Boolean(payload.published),
    createdAt: new Date().toISOString(),
  }

  store.posts.push(post)
  return post
}

export function publicProjects(store) {
  return store.projects.filter((item) => item.published)
}

export function publicPosts(store) {
  return store.posts.filter((item) => item.published)
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      if (!chunks.length) {
        resolve({})
        return
      }

      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('JSON invalido'))
      }
    })
    req.on('error', reject)
  })
}

function extractBearerToken(req) {
  const value = req.headers.authorization || ''
  if (!value.startsWith('Bearer ')) {
    return ''
  }
  return value.slice('Bearer '.length)
}

export function createApp(store = createStore(), credentials = {
  email: process.env.ADMIN_EMAIL || 'admin@portfolio.dev',
  password: process.env.ADMIN_PASSWORD || 'admin123',
}) {
  return async function app(req, res) {
    const url = new URL(req.url || '/', 'http://localhost')

    try {
      if (req.method === 'GET' && url.pathname === '/health') {
        sendJson(res, 200, { ok: true, service: 'portfolio-cms-headless' })
        return
      }

      if (req.method === 'POST' && url.pathname === '/admin/login') {
        const payload = await readJsonBody(req)
        const session = loginAdmin(store, payload, credentials)
        sendJson(res, 200, session)
        return
      }

      if (req.method === 'POST' && url.pathname === '/admin/projects') {
        const payload = await readJsonBody(req)
        const token = extractBearerToken(req)
        const project = createProject(store, token, payload)
        sendJson(res, 201, { project })
        return
      }

      if (req.method === 'POST' && url.pathname === '/admin/posts') {
        const payload = await readJsonBody(req)
        const token = extractBearerToken(req)
        const post = createPost(store, token, payload)
        sendJson(res, 201, { post })
        return
      }

      if (req.method === 'GET' && url.pathname === '/api/projects') {
        sendJson(res, 200, { projects: publicProjects(store) })
        return
      }

      if (req.method === 'GET' && url.pathname === '/api/posts') {
        sendJson(res, 200, { posts: publicPosts(store) })
        return
      }

      sendJson(res, 404, { error: 'rota nao encontrada' })
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : 'erro inesperado' })
    }
  }
}