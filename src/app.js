import { randomUUID } from 'node:crypto'

function slugify(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function ensureUniqueSlug(items, baseSlug, currentId = '') {
  let slug = baseSlug || 'item'
  let attempt = 1

  while (items.some((item) => item.slug === slug && item.id !== currentId)) {
    attempt += 1
    slug = `${baseSlug}-${attempt}`
  }

  return slug
}

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

  const slug = ensureUniqueSlug(store.projects, slugify(title))

  const project = {
    id: randomUUID(),
    slug,
    title,
    summary: String(payload.summary || '').trim(),
    tech: Array.isArray(payload.tech) ? payload.tech : [],
    published: Boolean(payload.published),
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }

  store.projects.push(project)
  return project
}

export function updateProject(store, token, projectId, payload) {
  assertAdmin(store, token)
  const project = store.projects.find((item) => item.id === projectId)
  if (!project) {
    throw new Error('projeto nao encontrado')
  }

  if (payload.title) {
    project.title = String(payload.title).trim()
    project.slug = ensureUniqueSlug(store.projects, slugify(project.title), project.id)
  }
  if (payload.summary !== undefined) {
    project.summary = String(payload.summary)
  }
  if (payload.tech !== undefined) {
    project.tech = Array.isArray(payload.tech) ? payload.tech : []
  }
  if (payload.published !== undefined) {
    project.published = Boolean(payload.published)
  }
  project.updatedAt = new Date().toISOString()
  return project
}

export function deleteProject(store, token, projectId) {
  assertAdmin(store, token)
  const index = store.projects.findIndex((item) => item.id === projectId)
  if (index < 0) {
    throw new Error('projeto nao encontrado')
  }
  const [project] = store.projects.splice(index, 1)
  return project
}

export function createPost(store, token, payload) {
  assertAdmin(store, token)

  const title = String(payload.title || '').trim()
  const content = String(payload.content || '').trim()
  if (!title || !content) {
    throw new Error('title e content sao obrigatorios')
  }

  const slug = ensureUniqueSlug(store.posts, slugify(title))

  const post = {
    id: randomUUID(),
    slug,
    title,
    content,
    tags: Array.isArray(payload.tags) ? payload.tags : [],
    published: Boolean(payload.published),
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  }

  store.posts.push(post)
  return post
}

export function updatePost(store, token, postId, payload) {
  assertAdmin(store, token)
  const post = store.posts.find((item) => item.id === postId)
  if (!post) {
    throw new Error('post nao encontrado')
  }

  if (payload.title) {
    post.title = String(payload.title).trim()
    post.slug = ensureUniqueSlug(store.posts, slugify(post.title), post.id)
  }
  if (payload.content !== undefined) {
    post.content = String(payload.content)
  }
  if (payload.tags !== undefined) {
    post.tags = Array.isArray(payload.tags) ? payload.tags : []
  }
  if (payload.published !== undefined) {
    post.published = Boolean(payload.published)
  }
  post.updatedAt = new Date().toISOString()
  return post
}

export function deletePost(store, token, postId) {
  assertAdmin(store, token)
  const index = store.posts.findIndex((item) => item.id === postId)
  if (index < 0) {
    throw new Error('post nao encontrado')
  }
  const [post] = store.posts.splice(index, 1)
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

      const projectMatch = url.pathname.match(/^\/admin\/projects\/([^/]+)$/)
      if (projectMatch && req.method === 'PATCH') {
        const payload = await readJsonBody(req)
        const token = extractBearerToken(req)
        const project = updateProject(store, token, projectMatch[1], payload)
        sendJson(res, 200, { project })
        return
      }
      if (projectMatch && req.method === 'DELETE') {
        const token = extractBearerToken(req)
        const project = deleteProject(store, token, projectMatch[1])
        sendJson(res, 200, { project })
        return
      }

      if (req.method === 'POST' && url.pathname === '/admin/posts') {
        const payload = await readJsonBody(req)
        const token = extractBearerToken(req)
        const post = createPost(store, token, payload)
        sendJson(res, 201, { post })
        return
      }

      const postMatch = url.pathname.match(/^\/admin\/posts\/([^/]+)$/)
      if (postMatch && req.method === 'PATCH') {
        const payload = await readJsonBody(req)
        const token = extractBearerToken(req)
        const post = updatePost(store, token, postMatch[1], payload)
        sendJson(res, 200, { post })
        return
      }
      if (postMatch && req.method === 'DELETE') {
        const token = extractBearerToken(req)
        const post = deletePost(store, token, postMatch[1])
        sendJson(res, 200, { post })
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