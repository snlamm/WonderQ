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
		QueueModel.query().insert({ id: 2, name: 'test-queue2' })
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

test('create message', async t => {
	const res = await request(t.context.app)
		.post('/messages')
		.send({ body: 'new-test-message-body', queue_id: 1 })

	t.is(res.body.id, 5)

	const message = await MessageModel.query().where('body', 'new-test-message-body').first()

	t.is(message.body, 'new-test-message-body')
})

test('delete message', async t => {
	let message = await MessageModel.query().findById(1)

	if(!message) {
		t.fail()
	}

	const res = await request(t.context.app)
		.delete('/messages/1')

	t.is(res.body.success, true)

	message = await MessageModel.query().findById(1)

	t.is(message, void 0)
})

test('message findMessages', async t => {
	const messages = await MessageModel.findMessages(1, 2)

	t.is(messages.length, 2)
	t.deepEqual(messages.map(m => m.id), [ 1, 2 ])
})

test('message findMessages respects retrievable_at constraint', async t => {
	const allMessages = await MessageModel.query().where({ queue_id: 1 })

	t.is(allMessages.length, 3)

	const messages = await MessageModel.findMessages(1, 3)

	t.is(messages.length, 2)
	t.deepEqual(messages.map(m => m.id), [ 1, 2 ])
})

test('message reserveMessages', async t => {
	const visibilityTimeout = 30
	const messages = await MessageModel.query().where({ queue_id: 1 })

	t.is(messages.length, 3)

	const { reservedNum, reservationToken } = await MessageModel.reserveMessages(messages, visibilityTimeout)

	t.is(reservedNum, 2)
	t.is(typeof reservationToken, 'string')

	const message = await MessageModel.query().where({ body: 'test-message-body-1' }).first()
	const time1 = new Date
	const time2 = new Date
	const retrivableBeforeEstimate = new Date(
		time1.setSeconds(time1.getSeconds() + (visibilityTimeout + 2))
	)
	const retrivableAfterEstimate = new Date(
		time2.setSeconds(time2.getSeconds() + (visibilityTimeout - 2))
	)

	t.is(message.reservation_token, reservationToken)

	const retrievableAt = new Date(message.retrievable_at)

	t.true((retrievableAt < retrivableBeforeEstimate) && (retrievableAt > retrivableAfterEstimate))
})

test('message findReservedMessages', async t => {
	const visibilityTimeout = 30
	const messages = await MessageModel.findMessages(1, 2)

	const { reservedNum, reservationToken } = await MessageModel.reserveMessages(messages, visibilityTimeout)
	const reservedMessages = await MessageModel.findReservedMessages(reservedNum, reservationToken)

	t.is(reservedMessages.length, 2)
	t.deepEqual(reservedMessages.map(m => m.reservation_token), [ reservationToken, reservationToken ])
})

test('message findReservedMessages respects retrievable_at constraint', async t => {
	const visibilityTimeout = 2
	const messages = await MessageModel.findMessages(1, 2)

	const { reservedNum, reservationToken } = await MessageModel.reserveMessages(messages, visibilityTimeout)

	await new Promise(resolve => {
		setTimeout(() => {
			return resolve()
		}, 2000)
	})

	const reservedMessages = await MessageModel.findReservedMessages(reservedNum, reservationToken)

	t.is(reservedMessages.length, 0)
})
