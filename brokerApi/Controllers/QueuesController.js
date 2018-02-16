const QueueModel = require('../Models/QueueModel.js')

module.exports = class QueuesController {

	static async create(req, res) {
		const name = req.body.name

		if(!name) {
			throw new Error('Name is required')
		}

		let queue = null

		try {
			queue = await QueueModel.query().insert({ name })
		} catch(err) {
			if(/UNIQUE constraint/.test(err.message)) {
				throw new Error('Queue already exists')
			}

			throw err
		}

		return res.send(queue)
	}

	static async find(req, res) {
		const query = QueueModel.query()

		if(req.query.id) {
			query.findById(req.query.id)
		} else if(req.query.name) {
			query.where('name', req.query.name).first()
		}

		res.send(await query)
	}

	static async destroy(req, res) {
		if(!req.params.queue) {
			throw new Error('Queue ID is required')
		}

		const query = await QueueModel.query().delete()
		query.where('id', req.params.queue)

		const success = await query

		return res.send({ success: !!success })
	}

}
