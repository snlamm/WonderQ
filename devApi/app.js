const express = require('express')
const morgan = require('morgan')
const bodyParser = require('body-parser')

const queuesController = require('./queuesController')
const db = require('../brokerApi/dbConfig.js')

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
		app.get('/queues', wrap(queuesController.index))
		app.get('/queues/:queue', wrap(queuesController.show))


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

	serve(port = 3210) {
		return this.$app.listen(port, () => console.log(`Listening on port ${port}`))
	}

}
