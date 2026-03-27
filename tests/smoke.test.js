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
  publicProjects,
  publicPosts,
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

  assert.equal(publicProjects(store).length, 2)
  assert.equal(publicPosts(store).length, 1)

  const deletedPost = deletePost(store, session.token, post.id)
  assert.equal(deletedPost.id, post.id)
})