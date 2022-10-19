import LibAV from 'libav.js'

function start() {
	console.log(import.meta.url)
	LibAV.LibAV().then(console.log)
}

export { start }