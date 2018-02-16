const test = require('ava').serial
const request = require('supertest')
const appSupport = require('../helpers/appSupport.js')
const dbSupport = require('../helpers/dbSupport.js')
const QueueModel = require('../../brokerApi/Models/QueueModel.js')
const MessageModel = require('../../brokerApi/Models/MessageModel.js')

test.beforeEach(async t => {
	t.context.app = (await appSupport.freshen()).$app

	await Promise.all([
		QueueModel.query().insert({ id: 1, name: 'test-queue1' }),
		QueueModel.query().insert({ id: 2, name: 'test-queue2' }),
		QueueModel.query().insert({ id: 3, name: 'test-queue3' })
	])

	const farInTheFuture = new Date(2100, 0, 0)

	await Promise.all([
		MessageModel.query().insert({ queue_id: 1, body: 'test-message-body-1', created_at: new Date }),
		MessageModel.query().insert({ queue_id: 1, body: 'test-message-body-2', created_at: new Date  }),
		MessageModel.query().insert({ queue_id: 1, body: 'test-message-body-3', retrievable_at: farInTheFuture, created_at: new Date }),
		MessageModel.query().insert({ queue_id: 2, body: 'test-message-body-4', created_at: new Date  })
	])
})

test.afterEach(() => {
	dbSupport.deleteDb()
})

test('poll consume', async t => {
	let res = await request(t.context.app)
		.get('/messages/consume')
		.query({ queue_id: 1, size: 3 })

	t.is(res.body.length, 2)
	t.deepEqual(res.body.map(message => message.id), [ 1, 2 ])

	res = await request(t.context.app)
		.get('/messages/consume')
		.query({ queue_id: 1, size: 3, wait_time: 0 })

	t.is(res.body.length, 0)
})

test('poll waits appropriately', async t => {
	const startTime = new Date

	const res = await request(t.context.app)
		.get('/messages/consume')
		.query({ queue_id: 3, wait_time: 2 })

	t.true((new Date - startTime) > 2000)
	t.is(res.body.length, 0)
})

test('poll with wait_time resolves with new message', async t => {
	setTimeout(async() => {
		await MessageModel.query().insert({ queue_id: 3, body: 'queue-4-test-body', created_at: new Date  })
	}, 2000)

	const startTime = new Date

	const res = await request(t.context.app)
		.get('/messages/consume')
		.query({ queue_id: 3, wait_time: 10 })

	t.true((new Date - startTime) < 4000)
	t.is(res.body.length, 1)
})

test('poll with multiple consumers avoids duplicate consumption', async t => {
	const app1 = (await appSupport.freshen()).$app
	const app2 = (await appSupport.freshen()).$app
	const app3 = (await appSupport.freshen()).$app

	// create queue and 100 messages
	await QueueModel.query().insert({ id: 3, name: 'test-queue3' })

	await Promise.all(Array.from(Array(100).keys()).map(i => {
		return MessageModel.query().insert({ queue_id: 3, body: `#${i}`, created_at: new Date  })
	}))

	const ids = [ ]
	const idsSet = new Set

	// method to consume the queue
	const consume = (app, size) => {
		return request(app)
			.get('/messages/consume')
			.query({ queue_id: 3, wait_time: 3, size })
	}

	console.log('Prepare for route logs!')

	// Poll messages with 3 apps and ensure each message is consumed only once
	while(idsSet.size < 100) {
		const randomSize = () => Math.floor((Math.random() * (8 - 2)) + 2)

		const [ res1, res2, res3 ] = await Promise.all([
			consume(app1, randomSize()),
			consume(app2, randomSize()),
			consume(app3, randomSize())
		])

		// If duplicate ids are present, ids and idsSet will have different sizes
		for(const message of [ ...res1.body, ...res2.body, ...res3.body ]) {
			ids.push(Number(message.id))
			idsSet.add(Number(message.id))
		}
	}

	t.true(ids.length === idsSet.size)
	t.is(ids.length, 100)

	ids.sort((a, b) => a < b ? -1 : 1)

	t.deepEqual([ ids[15], ids[35], ids[85] ], [ 16, 36, 86 ])
})
