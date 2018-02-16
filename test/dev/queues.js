const test = require('ava').serial
const request = require('supertest')
const appSupport = require('../helpers/appSupport.js')
const dbSupport = require('../helpers/dbSupport.js')
const MessageModel = require('../../brokerApi/Models/MessageModel.js')
const QueueModel = require('../../brokerApi/Models/QueueModel.js')

test.beforeEach(async t => {
	t.context.app = (await appSupport.freshen('dev')).$app

	await Promise.all([
		QueueModel.query().insert({ id: 1, name: 'test-queue1' }),
		QueueModel.query().insert({ id: 2, name: 'test-queue2' })
	])

	const farInTheFuture = new Date(2100, 0, 0)
	const farInThePast = new Date(1980, 0, 0)

	return Promise.all([
		MessageModel.query().insert({ queue_id: 1, body: 'test-message-body-1', created_at: new Date }),
		MessageModel.query().insert({ queue_id: 1, body: 'test-message-body-2', retrievable_at: farInThePast, created_at: new Date  }),
		MessageModel.query().insert({ queue_id: 1, body: 'test-message-body-3', retrievable_at: farInTheFuture, created_at: new Date }),
		MessageModel.query().insert({ queue_id: 2, body: 'test-message-body-4', created_at: new Date  })
	])
})

test.afterEach.always(() => {
	dbSupport.deleteDb()
})

test('dev queues show queues and messages counts', async t => {
	const res = await request(t.context.app).get('/queues')

	const queue1 = res.body.find(queue => queue.name === 'test-queue1')
	const queue2 = res.body.find(queue => queue.name === 'test-queue2')

	t.is(res.body.length, 2)
	t.is(queue1.queue_size, 3)
	t.is(queue1.retrievable_size, 2)
	t.is(queue2.queue_size, 1)
	t.is(queue2.retrievable_size, 1)
})

test('dev queues show messages', async t => {
	const res = await request(t.context.app)
		.get('/queues/1')
		.query({ size: 2 })

	t.is(res.body.length, 2)
	t.is(res.body[0].queue_id, 1)
})
