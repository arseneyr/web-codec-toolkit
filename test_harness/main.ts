import * as funcs from "../src/demux.js";
import LibAVFactory, { LibAVModule } from "libav.js";
import wasmUrl from "libav.js/wasm?url";
import { createWebCodecDecoder } from "../src/web_codec_decode.js";

type DemuxFuncs = typeof funcs;

declare global {
  interface Window {
    libav: Promise<LibAVModule>;
    testFuncs: DemuxFuncs;
    testData: () => Promise<ReadableStream>;
    demux: Awaited<ReturnType<typeof funcs["createDemuxer"]>>;
    decoder: ReturnType<typeof createWebCodecDecoder>;
    runDemux: () => Promise<void>;
    runDecode: () => Promise<void>;
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

window.decoder = createWebCodecDecoder();

async function* streamAsyncIterator<T>(
  stream: ReadableStream<T>
): AsyncIterable<T> {
  // Get a lock on the stream
  const reader = stream.getReader();

  try {
    while (true) {
      // Read from the stream
      const { done, value } = await reader.read();
      // Exit if we're done
      if (done) return;
      // Else yield the chunk
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

window.runDemux = async () => {
  for await (const frame of streamAsyncIterator(
    (await window.testData()).pipeThrough(window.demux)
  )) {
    console.log(frame);
  }
};

window.runDecode = async () => {
  for await (const audioData of streamAsyncIterator(
    (await window.testData())
      .pipeThrough(window.demux)
      .pipeThrough(window.decoder)
  )) {
    console.log(audioData);
  }
};

window.testData = () => fetch("/sample.opus").then((r) => r.body!);
