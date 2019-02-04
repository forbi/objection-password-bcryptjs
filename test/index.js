'use strict'

const test = require('ava')

const Argon2 = require('..')()
const Knex = require('knex')
const Model = require('objection').Model

const knex = Knex({
  client: 'sqlite3',
  connection: {
    filename: ':memory:'
  },
  useNullAsDefault: true
})

// bind knex instance to objection
Model.knex(knex)

// objection models
class Dog extends Argon2(Model) {
  static get tableName () {
    return 'dog'
  }
}

// tests
test.before(async (t) => {
  await knex.schema.createTable('dog', (table) => {
    table.increments()
    table.string('name')
    table.string('password')
  })
})

test('hashes and verifies a password', async (t) => {
  const password = 'Turtle123!'
  const dog = await Dog.query().insert({ name: 'JJ', password })
  t.true(await dog.verifyPassword(password))
})

test('creates new hash when updating password', async (t) => {
  const original = 'Turtle123!'
  const updated = 'Monkey69!'

  const dog = await Dog.query().insert({ name: 'JJ', password: original })
  t.true(await dog.verifyPassword(original))

  const updatedDog = await dog.$query().patchAndFetchById(dog.id, { password: updated })
  t.true(await updatedDog.verifyPassword(updated))
})

test('ignores hashing password field when patching a record where password isn\'t updated', async (t) => {
  const dog = await Dog.query().insert({ name: 'JJ', password: 'Turtle123!' })

  // update name only
  await dog.$query().patchAndFetchById(dog.id, { name: 'Jumbo Jet' })

  t.pass()
})

test('do not allow empty password', async (t) => {
  const password = ''
  const error = await t.throwsAsync(() => {
      return Dog.query().insert({ name: 'JJ', password })
  })
  t.is(error.message, 'password must not be empty')
})

test('allow empty password', async (t) => {
  const Argon2WithOptions = require('../')({ allowEmptyPassword: true })

  class Mouse extends Argon2WithOptions(Model) {
    static get tableName () {
      return 'mouse'
    }
  }

  await knex.schema.createTable('mouse', (table) => {
    table.increments()
    table.string('name')
    table.string('password')
  })

  const password = ''
  const mouse = await Mouse.query().insert({ name: 'Ricky', password })

  t.falsy(mouse.password)
})

test('throws an error when attempting to hash a argon2 hash', async (t) => {
  const error = await t.throwsAsync(() => {
      return Dog.query().insert({ name: 'JJ', password: '$argon2i$v=19$m=4096,t=3,p=1$yqdvmjCHT1o+03hbpFg7HQ$Vg3+D9kW9+Nm0+ukCzKNWLb0h8iPQdTkD/HYHrxInhA' })
  })
  t.is(error.message, 'Argon2 tried to hash another Argon2 hash')
})

test('can override default password field', async (t) => {
  const Argon2WithOptions = require('../')({ passwordField: 'hash' })

  class Cat extends Argon2WithOptions(Model) {
    static get tableName () {
      return 'cat'
    }
  }

  await knex.schema.createTable('cat', (table) => {
    table.increments()
    table.string('name')
    table.string('hash')
  })

  const password = 'Turtle123!'
  const cat = await Cat.query().insert({ name: 'Maude', hash: password })

  t.truthy(cat.hash)
  t.true(await cat.verifyPassword(password))
})

test('allows verifying two password strings', async (t) => {
    let matches = await Dog.verifyPassword('test', 'test')
    t.truthy(matches)

    matches = await Dog.verifyPassword('test', 'not-the-same')
    t.falsy(matches);
})
