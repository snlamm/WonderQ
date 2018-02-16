const cluster = require('cluster')
const Broker = require('./app.js')
let numCPUs = null

// start in normal or clustered mode
new Promise(async resolve => {
	if(process.argv.includes('--cluster')) {
		return runClustered(resolve)
	}

	return run(resolve)
})

async function run(resolve) {
	const app = new Broker()

	try {
		await app.ready()
	} catch(err) {
		console.error(err.stack)
		process.exit()
	}

	return resolve(app.serve())
}

function runClustered(resolve) {
	numCPUs = require('os').cpus().length

	if(!cluster.isMaster) {
		return run(resolve)
	}

	process.title = `${process.cwd()} [cluster] [master]`

	for(let i = 0; i < numCPUs; i ++) {
		cluster.fork()
	}

	cluster.on('exit', (deadWorker, code, signal) => {
		if(signal === 'SIGTERM' || signal === 'SIGINT') {
			return
		}

		console.log(`Reloading ${deadWorker.id}`)
		cluster.fork()
	})
}
