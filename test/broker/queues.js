const test = require('ava').serial
const request = require('supertest')
const appSupport = require('../helpers/appSupport.js')
const dbSupport = require('../helpers/dbSupport.js')
const QueueModel = require('../../brokerApi/Models/QueueModel.js')


test.beforeEach(async t => {
	t.context.app = (await appSupport.freshen()).$app
})

test.afterEach(() => {
	dbSupport.deleteDb()
})

test('queue create', async t => {
	const res = await request(t.context.app)
		.post('/queues')
		.send({ name: 'test-name' })

	t.is(res.body.name, 'test-name')

	const queue = await QueueModel.query().first()

	t.is(queue.name, 'test-name')
})

test('queue findByIdOrNameOrFail', async t => {
	await Promise.all([
		QueueModel.query().insert({ id: 1, name: 'test-name1' }),
		QueueModel.query().insert({ id: 2, name: 'test-name2' })
	])

	const queue1 = await QueueModel.findByIdOrNameOrFail(1)
	const queue2 = await QueueModel.findByIdOrNameOrFail(null, 'test-name2')

	t.is(queue1.name, 'test-name1')
	t.is(queue2.name, 'test-name2')
})
