const express = require('express')
const morgan = require('morgan')
const bodyParser = require('body-parser')

const db = require('./dbConfig.js')
const QueuesController = require('./Controllers/QueuesController.js')
const MessagesController = require('./Controllers/MessagesController.js')

module.exports = class App {

	constructor() {
		this.$app = null
	}

	async ready(dbPath = null) {
		await db.setup(dbPath)

		const app = this.$app = express()
			.use(morgan('tiny'))
			.use(bodyParser.json())

		// wrapper for async/await error catching
		const wrap = fn => (...args) => fn(...args).catch(args[2])

		// routes
		app.post('/queues', wrap(QueuesController.create))
		app.get('/queues/find', wrap(QueuesController.find))
		app.delete('/queues/:queue', wrap(QueuesController.destroy))

		app.post('/messages', wrap(MessagesController.create))
		app.get('/messages/consume', wrap(MessagesController.consume))
		app.delete('/messages/:message', wrap(MessagesController.destroy))

		// error handling middleware
		app.use((err, req, res, next) => {
			if(err) {
				console.error(err.stack)
				res.status(err.statusCode || err.status || 500).send(err.stack || {})
			} else {
				next()
			}
		})
	}

	serve(port = 3213) {
		return this.$app.listen(port, () => console.log(`Listening on port ${port}`))
	}

}
