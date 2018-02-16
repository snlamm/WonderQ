const UserApp = require('./app.js')

new Promise(async resolve => {
	const app = new UserApp()

	try {
		await app.ready()
	} catch(err) {
		console.error(err.stack)
		process.exit()
	}

	return resolve(app.serve())
})
