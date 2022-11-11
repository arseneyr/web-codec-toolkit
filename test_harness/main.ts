import * as funcs from "../src/demux";

type DemuxFuncs = typeof funcs;

declare global {
  interface Window {
    testFuncs: DemuxFuncs;
    testData: ArrayBuffer;
  }
}

window.testFuncs = funcs;
window.testData = await fetch("/sample.opus").then((r) => r.arrayBuffer());
