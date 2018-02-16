const request = require('request-promise')

module.exports = class MessagesController {

	static async dispatch(req, res) {
		const stubNum = Number(req.body.stub) || 1
		const messageBody = req.body.body
		const queueName = req.body.queue_name
		let queueId = req.body.queue_id

		const queue = await MessagesController._findOrCreateQueue(queueId, queueName)
		queueId = queue.id


		const dispatchMessage = body => {
			return request({
				uri: 'http://localhost:3213/messages',
				method: 'POST',
				body: {
					body,
					queue_id: queueId
				},
				json: true
			})
		}

		// either dispatch with a specified body or use programmatically generated stubs
		if(messageBody) {
			const message = await dispatchMessage(messageBody)
			return res.send({ created: 1, messages: [ message ] })
		}

		const failed = [ ]
		const numList = Array.from(Array(stubNum).keys())

		// dispatch stub messages
		let messages = await Promise.all(numList.map(i => {
			const message = `message #${i + 1} at ${Date.now()}`

			return dispatchMessage(message).catch(err => {
				console.error(err.message)

				// handle sqlite lock error, which can occur at high volume ex. stub = 500 in clustered mode
				if(/database is locked/.test(err.message)) {
					return dispatchMessage(message).catch(() => {
						failed.push({ body: message, err: err.message })
					})
				}
			})
		}))

		messages = messages.filter(m => m)

		return res.send({ created: (messages.length - failed.length), messages, failed })
	}

	static async _findOrCreateQueue(id, name) {
		const queue = await request({
			uri: 'http://localhost:3213/queues/find',
			qs: { name, id },
			json: true
		})

		if(queue) {
			return queue
		}

		try {
			return await request({
				uri: 'http://localhost:3213/queues',
				method: 'POST',
				body: { name },
				json: true
			})
		} catch(err) {
			throw new Error(`Unable to create queue: ${err.stack}`)
		}
	}


	static listen(req) {
		const params = {
			queue_name: req.query.queue_name,
			queue_id: req.query.queue_id,
			size: req.query.size,
			wait_time: req.query.wait_time,
			visibility_timeout: req.query.visibility_timeout
		}

		return MessagesController._listen(params)
	}

	static async _listen(params) {
		let messages = null

		// poll the broker
		try {
			messages = await request({
				uri: 'http://localhost:3213/messages/consume',
				qs: params,
				json: true
			})
		} catch(err) {
			// handle case where tests shut down server
			if(/socket hang up/.test(err.message) && process.env.NODE_ENV === 'test') {
				err._shouldLog = false
			}

			throw err
		}

		if(!messages || (messages.length === 0)) {
			return this._listen(params)
		}

		// process the message and then delete it
		for(const message of messages) {
			// do 'something' with the message
			console.log(`Processing message: ${message.body}`)

			let result = null

			try {
				result = await request({
					uri: `http://localhost:3213/messages/${message.id}`,
					method: 'DELETE',
					qs: params,
					json: true
				})
			} catch(err) {
				// handle case where tests shut down server
				if(/ECONNREFUSED/.test(err.message) && process.env.NODE_ENV === 'test') {
					err._shouldLog = false
				}

				throw err
			}

			if(!result || (result.success !== true)) {
				console.error(`Failed to delete message ${message.id}`)
			}
		}

		return this._listen(params)
	}

}
