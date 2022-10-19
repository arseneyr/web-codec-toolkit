/// <reference types="vite/client" />

declare module "libav.js" {

import {type LibAVWrapper} from 'libav.js/libav.types'
	var libav: LibAVWrapper;
	export default libav;
}