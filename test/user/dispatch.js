const test = require('ava').serial
const request = require('supertest')
const appSupport = require('../helpers/appSupport.js')
const dbSupport = require('../helpers/dbSupport.js')
const MessageModel = require('../../brokerApi/Models/MessageModel.js')
const QueueModel = require('../../brokerApi/Models/QueueModel.js')

test.beforeEach(async t => {
	t.context.app = (await appSupport.freshen('user')).$app

	const brokerApp = await appSupport.freshen('broker')
	return t.context.brokerServer = brokerApp.serve()
})

test.afterEach.always(t => {
	t.context.brokerServer.close()
	dbSupport.deleteDb()
})

test('dispatch custom message', async t => {
	const res = await request(t.context.app)
		.post('/dispatch')
		.send({ queue_name: 'new-test-queue', body: 'test-message' })

	const message = await MessageModel.query().where('body', 'test-message').first()

	t.is(res.body.created, 1)
	t.is(message.body, 'test-message')
})

test('dispatch message with new queue creates the queue', async t => {
	await request(t.context.app)
		.post('/dispatch')
		.send({ queue_name: 'new-test-queue2', body: 'test-message' })

	const queue = await QueueModel.query().orderBy('id', 'desc').first()

	t.is(queue.name, 'new-test-queue2')
})

test('dispatch message with existing queue uses the queue', async t => {
	const queue = await QueueModel.query().insert({ name: 'old-test-queue' })

	await request(t.context.app)
		.post('/dispatch')
		.send({ queue_name: 'old-test-queue', body: 'test-message' })

	const message = await MessageModel.query().first()

	t.is(message.queue_id, queue.id)
})

test('dispatch random messages', async t => {
	const res = await request(t.context.app)
		.post('/dispatch')
		.send({ queue_name: 'new-test-queue', stub: 10 })

	const messages = await MessageModel.query()
	let counter = 0

	for(let i = 0; i < res.body.messages.length; i ++) {
		const findNumbersRegex = new RegExp(`#${i + 1}`, 'ig')

		if(messages.find(message => findNumbersRegex.test(message.body))) {
			counter += 1
		}
	}

	t.is(res.body.created, 10)
	t.is(res.body.messages.length, 10)
	t.is(counter, 10)
})
