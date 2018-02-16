const Broker = require('../../brokerApi/app.js')
const User = require('../../userApi/app.js')
const Dev = require('../../devApi/app.js')
const dbSupport = require('./dbSupport.js')

const apps = {
	broker: Broker,
	user: User,
	dev: Dev
}

module.exports = {
	// delete db and recreate app
	freshen: async appName => {
		dbSupport.deleteDb()
		const app = new (apps[appName] || Broker)()
		await app.ready(dbSupport.dbFilePath)

		return app
	},

	// keep track of open sockets
	trackSockets: server => {
		const sockets = { }
		let nextSocketId = 0

		server.on('connection', socket => {
			const socketId = sockets[nextSocketId++] = socket

			socket.once('close', () => {
				delete sockets[socketId]
			})
		})

		return sockets
	},

	// close server and individually destroy sockets
	forceCloseServer: (server, sockets) => {
		server.close()

		for(const socket of Object.values(sockets)) {
			socket.destroy()
		}
	}
}
