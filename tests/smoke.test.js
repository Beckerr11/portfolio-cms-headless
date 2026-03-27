import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createStore,
  loginAdmin,
  createProject,
  updateProject,
  createPost,
  updatePost,
  deletePost,
  createPreviewToken,
  listProjects,
  listPosts,
  revokePreviewToken,
} from '../src/app.js'

test('cms flow supports admin write/update and public read', () => {
  const store = createStore()
  const credentials = { email: 'admin@portfolio.dev', password: 'admin123' }

  const session = loginAdmin(store, credentials, credentials)

  const projectA = createProject(store, session.token, {
    title: 'Portfolio v2',
    summary: 'Refatoracao completa',
    published: true,
  })

  const projectB = createProject(store, session.token, {
    title: 'Portfolio v2',
    summary: 'Mesmo titulo',
    published: false,
  })

  assert.notEqual(projectA.slug, projectB.slug)

  const updated = updateProject(store, session.token, projectB.id, { published: true })
  assert.equal(updated.published, true)

  const post = createPost(store, session.token, {
    title: 'Como construi meu portfolio',
    content: 'Conteudo completo',
    published: false,
  })

  const postUpdated = updatePost(store, session.token, post.id, { published: true, tags: ['dev'] })
  assert.equal(postUpdated.published, true)
  assert.equal(postUpdated.tags.length, 1)

  assert.equal(listProjects(store).length, 2)
  assert.equal(listPosts(store).length, 1)

  const deletedPost = deletePost(store, session.token, post.id)
  assert.equal(deletedPost.id, post.id)
})

test('preview token allows reading drafts and can be revoked', () => {
  const store = createStore()
  const credentials = { email: 'admin@portfolio.dev', password: 'admin123' }
  const session = loginAdmin(store, credentials, credentials)

  createProject(store, session.token, {
    title: 'Projeto Draft',
    summary: 'Nao publicado',
    published: false,
  })

  createPost(store, session.token, {
    title: 'Post Draft',
    content: 'Conteudo rascunho',
    published: false,
  })

  assert.equal(listProjects(store).length, 0)
  assert.equal(listPosts(store).length, 0)

  const previewToken = createPreviewToken(store, session.token, { ttlMinutes: 30 })

  const projectsWithPreview = listProjects(store, { previewToken: previewToken.token })
  const postsWithPreview = listPosts(store, { previewToken: previewToken.token })
  assert.equal(projectsWithPreview.length, 1)
  assert.equal(postsWithPreview.length, 1)

  revokePreviewToken(store, session.token, previewToken.token)

  assert.equal(listProjects(store, { previewToken: previewToken.token }).length, 0)
  assert.equal(listPosts(store, { previewToken: previewToken.token }).length, 0)
})
