const test = require('ava').serial
const db = require('../../brokerApi/dbConfig.js')
const dbSupport = require('../helpers/dbSupport.js')
const QueueModel = require('../../brokerApi/Models/QueueModel')
const MessageModel = require('../../brokerApi/Models/MessageModel')

test.beforeEach(async() => {
	const activeDb = await db.setup(dbSupport.dbFilePath)
	await dbSupport.purgeTables(activeDb)
})

test.after.always(() => {
	dbSupport.deleteDb()
})

test('insert and select from message model', async t => {
	await QueueModel.query().insert({ name: 'testing' })
	const queue = await QueueModel.query().first()

	t.is(queue.name, 'testing')
})

test('insert and select from queue model', async t => {
	const queue = await QueueModel.query().insert({ name: 'stub queue' })
	await MessageModel.query().insert({
		body: 'stub data',
		created_at: new Date(),
		queue_id: queue.id
	})

	const message = await MessageModel.query().eager('queue').first()

	t.is(message.body, 'stub data')
	t.is(message.queue.name, 'stub queue')
})
