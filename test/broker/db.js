const test = require('ava').serial
const db = require('../../brokerApi/dbConfig.js')
const dbSupport = require('../helpers/dbSupport.js')

test.beforeEach(async t => {
	dbSupport.deleteDb()
	t.context.db = await db.setup(dbSupport.dbFilePath)
})

test.after.always(() => {
	dbSupport.deleteDb()
})

test('creates db file', t => {
	t.true(dbSupport.hasExistingDb())
})

test('creates db tables', async t => {
	t.true(await t.context.db.schema.hasTable('queues'))
	t.true(await t.context.db.schema.hasTable('messages'))
})
