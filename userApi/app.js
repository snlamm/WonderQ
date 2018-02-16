const express = require('express')
const morgan = require('morgan')
const bodyParser = require('body-parser')
const messagesController = require('./messagesController.js')

module.exports = class App {

	constructor() {
		this.$app = null
	}

	async ready() {
		const app = this.$app = express()
			.use(morgan('tiny'))
			.use(bodyParser.json())

		// wrapper for async/await error catching
		const wrap = fn => (...args) => fn(...args).catch(args[2])

		// routes
		app.post('/dispatch', wrap(messagesController.dispatch))
		app.get('/listen', wrap(messagesController.listen))


		// error handling middleware
		app.use((err, req, res, next) => {
			if(err) {
				if(err._shouldLog !== false) {
					console.error(err.stack)
				}

				res.status(err.statusCode || err.status || 500).send(err.stack || {})
			} else {
				next()
			}
		})
	}

	serve(port = 3000) {
		return this.$app.listen(port, () => console.log(`Listening on port ${port}`))
	}

}
