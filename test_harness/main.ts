import * as funcs from "../src/demux.js";
import LibAVFactory, { LibAVModule } from "libav.js/lite";
import wasmUrl from "libav.js/wasm/lite?url";

type DemuxFuncs = typeof funcs;

declare global {
  interface Window {
    libav: Promise<LibAVModule>;
    testFuncs: DemuxFuncs;
    testData: ReadableStream;
    demux: Awaited<ReturnType<typeof funcs["createDemuxer"]>>;
  }
}

window.testFuncs = funcs;

window.libav = fetch(wasmUrl)
  .then((r) => r.arrayBuffer())
  .then((wasmBinary) =>
    LibAVFactory({
      wasmBinary,
    })
  );

window.demux = funcs.createDemuxer(await window.libav);

await fetch("/sample.opus").then((r) => (window.testData = r.body!));
