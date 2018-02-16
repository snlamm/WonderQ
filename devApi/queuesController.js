const QueueModel = require('../brokerApi/Models/QueueModel')
const MessageModel = require('../brokerApi/Models/MessageModel')

module.exports = class QueuesController {

	static async index(req, res) {
		const countQuery = QueueModel.query().select('queues.id', 'queues.name')
		countQuery.count('messages.id as queue_size')
		countQuery.join('messages', 'messages.queue_id', 'queues.id')
		countQuery.groupBy('messages.queue_id')

		const retrievableCountQuery =  QueueModel.query().select('queues.id')
		retrievableCountQuery.count('messages.id as retrievable_size')
		retrievableCountQuery.join('messages', 'messages.queue_id', 'queues.id')
		retrievableCountQuery.where(subQuery => {
			subQuery.whereNull('retrievable_at')
			subQuery.orWhereRaw(`retrievable_at < ${Date.now()}`)
		})
		retrievableCountQuery.groupBy('messages.queue_id')

		const [ queues, retrievableCounts ] = await Promise.all([ countQuery, retrievableCountQuery ])

		for(const queue of queues) {
			const retrievable = retrievableCounts.find(retrievable => queue.id === retrievable.id)
			queue.retrievable_size = retrievable.retrievable_size
		}

		return res.send(queues)
	}

	static async show(req, res) {
		const query = MessageModel.query()
		query.select('*')
		query.where('queue_id', req.params.queue)
		query.groupBy('id')
		query.limit(req.query.size || 10)

		res.send(await query)
	}

}
