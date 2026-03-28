import { buildLandingHtml } from './ui/landing.js'
import { randomUUID } from 'node:crypto'

const MAX_BODY_SIZE_BYTES = 1_000_000

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
    previewTokens: [],
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

function parseTtlMinutes(value, fallback = 30) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback
  }
  return Math.min(Math.round(parsed), 24 * 60)
}

export function createPreviewToken(store, token, payload = {}, defaults = {}) {
  assertAdmin(store, token)

  const ttlMinutes = parseTtlMinutes(payload.ttlMinutes ?? defaults.ttlMinutes, 30)
  const previewToken = randomUUID().replace(/-/g, '')

  const record = {
    token: previewToken,
    label: String(payload.label || 'preview').trim(),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + ttlMinutes * 60 * 1000).toISOString(),
    revokedAt: null,
  }

  store.previewTokens.push(record)
  return record
}

export function revokePreviewToken(store, token, previewToken) {
  assertAdmin(store, token)

  const record = store.previewTokens.find((item) => item.token === previewToken)
  if (!record) {
    throw new Error('preview token nao encontrado')
  }

  record.revokedAt = new Date().toISOString()
  return record
}

export function listPreviewTokens(store, token) {
  assertAdmin(store, token)
  return store.previewTokens.map((item) => ({ ...item }))
}

function isPreviewTokenValid(store, previewToken) {
  if (!previewToken) {
    return false
  }

  const record = store.previewTokens.find((item) => item.token === previewToken)
  if (!record || record.revokedAt) {
    return false
  }

  return new Date(record.expiresAt).getTime() > Date.now()
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

function applyUpdatedAfterFilter(items, updatedAfter) {
  if (!updatedAfter) {
    return items
  }

  const afterTs = new Date(updatedAfter).getTime()
  if (!Number.isFinite(afterTs)) {
    throw new Error('updatedAfter invalido')
  }

  return items.filter((item) => new Date(item.updatedAt).getTime() >= afterTs)
}

export function listProjects(store, filters = {}) {
  const includeDraft = isPreviewTokenValid(store, filters.previewToken)
  const source = includeDraft ? store.projects : store.projects.filter((item) => item.published)
  return applyUpdatedAfterFilter(source, filters.updatedAfter)
}

export function listPosts(store, filters = {}) {
  const includeDraft = isPreviewTokenValid(store, filters.previewToken)
  const source = includeDraft ? store.posts : store.posts.filter((item) => item.published)
  return applyUpdatedAfterFilter(source, filters.updatedAfter)
}

export function publicProjects(store) {
  return listProjects(store)
}

export function publicPosts(store) {
  return listPosts(store)
}

function findBySlug(items, slug) {
  const item = items.find((entry) => entry.slug === slug)
  if (!item) {
    throw new Error('conteudo nao encontrado')
  }
  return item
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'content-type': 'application/json' })
  res.end(JSON.stringify(payload))
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let totalSize = 0
    req.on('data', (chunk) => {
      totalSize += chunk.length
      if (totalSize > MAX_BODY_SIZE_BYTES) {
        reject(new Error('payload excede limite de 1MB'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
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

export function createApp(
  store = createStore(),
  credentials = {
    email: process.env.ADMIN_EMAIL || 'admin@portfolio.dev',
    password: process.env.ADMIN_PASSWORD || 'admin123',
  },
  options = {}
) {
  const previewDefaults = {
    ttlMinutes: parseTtlMinutes(options.previewTokenTtlMinutes || process.env.PREVIEW_TOKEN_TTL_MINUTES, 30),
  }

  return async function app(req, res) {
    const url = new URL(req.url || '/', 'http://localhost')

    try {
            if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
        res.end(buildLandingHtml())
        return
      }

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

      if (req.method === 'POST' && url.pathname === '/admin/preview-tokens') {
        const payload = await readJsonBody(req)
        const token = extractBearerToken(req)
        const previewToken = createPreviewToken(store, token, payload, previewDefaults)
        sendJson(res, 201, { previewToken })
        return
      }

      if (req.method === 'GET' && url.pathname === '/admin/preview-tokens') {
        const token = extractBearerToken(req)
        const previewTokens = listPreviewTokens(store, token)
        sendJson(res, 200, { previewTokens })
        return
      }

      const previewTokenMatch = url.pathname.match(/^\/admin\/preview-tokens\/([^/]+)$/)
      if (previewTokenMatch && req.method === 'DELETE') {
        const token = extractBearerToken(req)
        const previewToken = revokePreviewToken(store, token, previewTokenMatch[1])
        sendJson(res, 200, { previewToken })
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
        const projects = listProjects(store, {
          previewToken: url.searchParams.get('previewToken') || '',
          updatedAfter: url.searchParams.get('updatedAfter') || '',
        })
        sendJson(res, 200, { projects })
        return
      }

      const projectSlugMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/)
      if (req.method === 'GET' && projectSlugMatch) {
        const projects = listProjects(store, {
          previewToken: url.searchParams.get('previewToken') || '',
        })
        const project = findBySlug(projects, projectSlugMatch[1])
        sendJson(res, 200, { project })
        return
      }

      if (req.method === 'GET' && url.pathname === '/api/posts') {
        const posts = listPosts(store, {
          previewToken: url.searchParams.get('previewToken') || '',
          updatedAfter: url.searchParams.get('updatedAfter') || '',
        })
        sendJson(res, 200, { posts })
        return
      }

      const postSlugMatch = url.pathname.match(/^\/api\/posts\/([^/]+)$/)
      if (req.method === 'GET' && postSlugMatch) {
        const posts = listPosts(store, {
          previewToken: url.searchParams.get('previewToken') || '',
        })
        const post = findBySlug(posts, postSlugMatch[1])
        sendJson(res, 200, { post })
        return
      }

      sendJson(res, 404, { error: 'rota nao encontrada' })
    } catch (error) {
      sendJson(res, 400, { error: error instanceof Error ? error.message : 'erro inesperado' })
    }
  }
}


