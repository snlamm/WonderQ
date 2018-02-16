/*
	Set up database
*/
const knex = require('knex')
const { Model } = require('objection')

async function setup(filepath) {
	const db = knex({
		client: 'sqlite3',
		connection: { filename: filepath || './brokerApi/database.db' },
		useNullAsDefault: true
	})

	// Connect objection ORM to knex
	Model.knex(db)

	const hasQueuesTable = await db.schema.hasTable('queues')
	const hasMessagesTable = await db.schema.hasTable('messages')

	// Create tables if not yet created
	if(!hasQueuesTable) {
		await db.schema.createTable('queues', table => {
			table.increments('id').primary()
			table.string('name').unique().notNullable()
		})
	}

	if(!hasMessagesTable) {
		await db.schema.createTable('messages', table => {
			table.increments('id').primary()
			table.integer('queue_id').unsigned().references('id').inTable('queues').onDelete('cascade').index().notNullable()
			table.text('body').nullable()
			table.dateTime('retrievable_at').index()
			table.string('reservation_token', 32).unsigned().index()
			table.dateTime('created_at')
		})
	}

	return db
}

module.exports = { setup }
