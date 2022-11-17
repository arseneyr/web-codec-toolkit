import * as funcs from "../src/demux";

type DemuxFuncs = typeof funcs;

declare global {
  interface Window {
    testFuncs: DemuxFuncs;
    testData: ReadableStream;
  }
}

window.testFuncs = funcs;
await fetch("/sample.opus").then((r) => (window.testData = r.body!));
