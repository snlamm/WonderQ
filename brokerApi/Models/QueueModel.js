const Model = require('objection').Model

module.exports = class QueueModel extends Model {

	static get tableName() {
		return 'queues'
	}

	static get jsonSchema() {
		return {
			type: 'object',
			required: [ 'name' ],

			properties: {
				id: { type: 'integer' },
				name: { type: [ 'string, null' ] }
			}
		}
	}

	static get relationMappings() {
		return {
			queue: {
				relation: Model.HasManyRelation,
				modelClass: `${__dirname}/MessageModel.js`,
				join: {
					from: 'queues.id',
					to: 'messages.queue_id'
				}
			}
		}
	}

	static async findByIdOrNameOrFail(id, name) {
		let queue = null

		if(id) {
			queue = await this.query().findById(id)
		} else if(name) {
			queue = await this.query().where('name', name).first()
		}

		if(!queue) {
			throw new Error('Unable to find queue')
		}

		return queue
	}

}
