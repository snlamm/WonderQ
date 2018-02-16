/* eslint-disable no-sync */
const fs = require('fs')

const dbFilePath = './test/test.db'
const hasExistingDb = () => fs.existsSync(dbFilePath)

module.exports = {
	deleteDb: () => {
		if(hasExistingDb()) {
			fs.unlinkSync(dbFilePath)
		}
	},

	purgeTables: async db => {
		await db('queues').delete()
		await db('messages').delete()
	},

	hasExistingDb,
	dbFilePath
}
