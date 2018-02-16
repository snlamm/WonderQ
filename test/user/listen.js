const test = require('ava').serial
const request = require('supertest')
const intercept = require('intercept-stdout')
const appSupport = require('../helpers/appSupport.js')
const dbSupport = require('../helpers/dbSupport.js')
const MessageModel = require('../../brokerApi/Models/MessageModel.js')

let unhookIntercept = null
// intercept console logs for a specified amount of time. Then close server.
const logListensAndClose = (t, textTracker, waitTime) => {
	intercept(text => {
		textTracker.text += text

		const currentOutput = textTracker.text
		setTimeout(() => {
			if(currentOutput === textTracker.text) {
				appSupport.forceCloseServer(t.context.brokerServer, t.context.brokerSockets)
				unhookIntercept()
			}
		}, waitTime)
	})
}

test.before(() => {
	// unhookIntercept will stop intercepts of console logs
	unhookIntercept = intercept(() => '')
	unhookIntercept()
})

test.beforeEach(async t => {
	t.context.app = (await appSupport.freshen('user')).$app

	const brokerApp = await appSupport.freshen('broker')
	const server = brokerApp.serve()

	t.context.brokerApp = brokerApp
	t.context.brokerSockets = appSupport.trackSockets(server)
	t.context.brokerServer = server
})

test.afterEach.always(t => {
	unhookIntercept()

	appSupport.forceCloseServer(t.context.brokerServer, t.context.brokerSockets)
	dbSupport.deleteDb()
})

test('listen processes a message', async t => {
	await request(t.context.app)
		.post('/dispatch')
		.send({ queue_name: 'new-test-queue', body: 'test-message' })

	const textTracker = { text: '' }
	logListensAndClose(t, textTracker, 100)

	await request(t.context.app)
		.get('/listen')
		.query({ queue_name: 'new-test-queue' })

	t.true(/Processing message: test-message/.test(textTracker.text))
})

test('listen deletes messages after processing', async t => {
	await request(t.context.app)
		.post('/dispatch')
		.send({ queue_name: 'new-test-queue', stub: 2 })

	let message = await MessageModel.query().first()

	t.true(/message #/.test(message.body))

	const textTracker = { text: '' }
	logListensAndClose(t, textTracker, 100)

	await request(t.context.app)
		.get('/listen')
		.query({ queue_name: 'new-test-queue' })

	message = await MessageModel.query().first()

	t.true(/message #1/.test(textTracker.text) && /message #2/.test(textTracker.text))
	t.is(message, void 0)
})

test('listen passes visibility_timeout and size correctly', async t => {
	await request(t.context.app)
		.post('/dispatch')
		.send({ queue_name: 'new-test-queue', stub: 5 })

	const textTracker = { text: '' }

	// poll queue but immediately close server before messages can be processed
	logListensAndClose(t, textTracker, 0)

	await request(t.context.app)
		.get('/listen')
		.query({ queue_name: 'new-test-queue', visibility_timeout: 10, size: 5 })

	const message = await MessageModel.query().orderBy('retrievable_at', 'asc').first()

	t.true(message.retrievable_at - Date.now() > 9000)
})
