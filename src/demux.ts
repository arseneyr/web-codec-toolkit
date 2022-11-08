import LibAV from 'libav.js'

async function start() {
	console.log(import.meta.url)
	const av = await LibAV.LibAV();
	return av;
}

export { start }