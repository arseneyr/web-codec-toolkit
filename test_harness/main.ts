import * as funcs from '../src/demux'

type DemuxFuncs = typeof funcs;

declare global {
  interface Window {
    testFuncs: DemuxFuncs
  }
}

window.testFuncs = funcs
