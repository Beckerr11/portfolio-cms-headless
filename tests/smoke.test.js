import test from 'node:test'
import assert from 'node:assert/strict'
import { createStore, loginAdmin, createProject, createPost, publicProjects, publicPosts } from '../src/app.js'

test('cms flow supports admin write and public read', () => {
  const store = createStore()
  const credentials = { email: 'admin@portfolio.dev', password: 'admin123' }

  const session = loginAdmin(store, credentials, credentials)

  createProject(store, session.token, {
    title: 'Portfolio v2',
    summary: 'Refatoracao completa',
    published: true,
  })

  createPost(store, session.token, {
    title: 'Como construi meu portfolio',
    content: 'Conteudo completo',
    published: true,
  })

  assert.equal(publicProjects(store).length, 1)
  assert.equal(publicPosts(store).length, 1)
})