const DevApp = require('./app.js')

new Promise(async resolve => {
	const app = new DevApp()

	try {
		await app.ready()
	} catch(err) {
		console.error(err.stack)
		process.exit()
	}

	return resolve(app.serve())
})
