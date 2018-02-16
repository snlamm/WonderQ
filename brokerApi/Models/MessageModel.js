const Model = require('objection').Model
const crypto = require('crypto')

module.exports = class MessageModel extends Model {

	static get tableName() {
		return 'messages'
	}

	static get jsonSchema() {
		return {
			type: 'object',
			required: [ 'body', 'created_at', 'queue_id' ],

			properties: {
				id: { type: 'integer' },
				queue_id: { type: 'integer' },
				body: { type: 'string' },
				retrievable_at: { type: 'datetime' },
				reservation_token: { type: [ 'string', 'null' ] },
				created_at: { type: 'datetime' }
			}
		}
	}

	static get relationMappings() {
		return {
			queue: {
				relation: Model.BelongsToOneRelation,
				modelClass: `${__dirname}/QueueModel.js`,
				join: {
					from: 'messages.queue_id',
					to: 'queues.id'
				}
			}
		}
	}

	static async findMessages(queueId, size) {
		const query = this.query().select('*')
		query.where('queue_id', queueId)
		query.where(subQuery => {
			subQuery.whereNull('retrievable_at')
			subQuery.orWhere('retrievable_at', '<', new Date)
		})
		query.limit(size)

		return query
	}

	static async reserveMessages(messages, visibilityTimeout) {
		if(messages.length === 0) {
			return { reservedNum: 0, reservationToken: null }
		}

		const reservationToken = crypto.randomBytes(6).toString('hex')
		const currentTime = new Date
		const retrievableAt = new Date(currentTime.setSeconds(currentTime.getSeconds() + visibilityTimeout))

		// Reserve a message by setting its retrievable_at and reservation_token
		const query = this.query()
		query.patch({
			retrievable_at: retrievableAt,
			reservation_token: reservationToken
		})
		query.where(subQuery => {
			subQuery.whereNull('retrievable_at')
			subQuery.orWhere('retrievable_at', '<', new Date)
		})
		query.whereIn('id', messages.map(message => message.id))

		const reservedNum = await query

		return { reservedNum, reservationToken }
	}

	static async findReservedMessages(reservedNum, reservationToken) {
		if(reservedNum === 0) {
			return [ ]
		}

		// Find message with the specified reservation_token whose visibility_timeout has not expired
		const query = this.query()
		query.where('retrievable_at', '>', new Date)
		query.where('reservation_token', reservationToken)
		query.limit(reservedNum)

		return query
	}


}
