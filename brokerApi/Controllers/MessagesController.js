const MessageModel = require('../Models/MessageModel.js')
const QueueModel = require('../Models/QueueModel.js')

module.exports = class MessagesController {

	static async create(req, res) {
		if(!req.body.body) {
			throw new Error('Message body is required')
		}

		const queue = await QueueModel.findByIdOrNameOrFail(req.body.queue_id, req.body.queue_name)

		const message = await MessageModel.query().insert({
			body: req.body.body,
			queue_id: queue.id,
			created_at: new Date
		})

		// Message id acts as SQS MessageReceipt
		return res.send({ id: message.id })
	}

	static async consume(req, res) {
		const queue = await QueueModel.findByIdOrNameOrFail(req.query.queue_id, req.query.queue_name)
		const pollingTime = req.query.wait_time || 20
		const size = req.query.size || 1
		const visibilityTimeout = req.query.visibility_timeout || 30

		// polling query to find and reserve messages to return to client
		const pollQuery = async() => {
			const messages = await MessageModel.findMessages(queue.id, size)
			const { reservedNum, reservationToken } = await MessageModel.reserveMessages(messages, visibilityTimeout)
			return MessageModel.findReservedMessages(reservedNum, reservationToken)
		}

		let reservedMessages = await pollQuery()

		if(reservedMessages.length === 0) {
			const startTime = new Date

			// Stagger polls between 1 and 2 second intervals until a message is returned or pollingTime is exceeded
			await new Promise(resolve => {
				const poll = setInterval(async() => {
					reservedMessages = await pollQuery()

					const isOverPollingLimit = (new Date - startTime) > (pollingTime * 1000)

					if((reservedMessages.length > 0) || isOverPollingLimit) {
						resolve(clearInterval(poll))
					}
				}, 1000 * ((Math.random() * (2 - 1)) + 1))
			})
		}

		return res.send(reservedMessages)
	}

	static async destroy(req, res) {
		if(!req.params.message) {
			throw new Error('Message ID is required')
		}

		const query = MessageModel.query().delete()
		query.where('id', req.params.message)

		const success = await query

		return res.send({ success: !!success })
	}

}
