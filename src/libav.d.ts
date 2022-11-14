import { type LibAVWrapper, type LibAV } from "libav.js";

declare module "libav.js" {
  export interface LibAV extends EmscriptenModule {}
  var libav: LibAVWrapper;
  export default libav;
}
