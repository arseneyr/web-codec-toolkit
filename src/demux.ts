import LibAVFactory, {
  AVFormatContextPtr,
  AVPacketPtr,
  NULLPTR,
  type LibAVModule,
} from "libav.js/lite";
import wasmUrl from "libav.js/wasm/lite?url";

class Decoder {
  private constructor(private readonly av: LibAVModule) {}

  public async decode(stream: ReadableStream) {
    const ret: AudioData[] = [];
    const decoder = new AudioDecoder({
      output: (audioData) => ret.push(audioData),
      error: console.error,
    });
    // await this.av.writeFile("tmpfile", new Uint8Array(buf));
    // const [fmtCtx, [stream]] = await this.av.ff_init_demuxer_file("tmpfile");
    const fmtCtx = await this.av.avformat_open_input_stream(stream);
    // const timeBase_us =
    //   (stream.time_base_num * 1000 * 1000) / stream.time_base_den;
    // decoder.configure({
    //   codec: "opus",
    //   numberOfChannels: await this.av.AVCodecParameters_channels(
    //     stream.codecpar
    //   ),
    //   sampleRate: await this.av.AVCodecParameters_sample_rate(stream.codecpar),
    // });

    // const packet = await this.av.av_packet_alloc();
    // while ((await this.av.av_read_frame(fmtCtx, packet)) >= 0) {
    //   // const [data, size, pts, duration] = await Promise.all([
    //   //   this.av.AVPacket_data(packet),
    //   //   this.av.AVPacket_size(packet),
    //   //   this.av.AVPacket_pts(packet),
    //   //   this.av.AVPacket_duration(packet),
    //   // ]);
    //   const { data, pts, duration } = await this.av.ff_copyout_packet(packet);
    //   decoder.decode(
    //     new EncodedAudioChunk({
    //       // data: this.av.HEAPU8.subarray(data, data + size),
    //       data,
    //       timestamp: pts ?? 0 * timeBase_us,
    //       type: "key",
    //       duration: duration ?? 0 * timeBase_us,
    //     })
    //   );
    //   this.av.av_packet_unref(packet);
    // }
    // await decoder.flush();
    // return ret;
  }

  // #onDecode = (audioData: AudioData) => {};
  // #decoder = new AudioDecoder({
  //   output: this.#onDecode,
  //   error: (err) => console.error(err),
  // });

  public static async create() {
    return new Decoder(
      await LibAVFactory({
        wasmBinary: await fetch(wasmUrl).then((r) => r.arrayBuffer()),
      })
    );
  }
}

interface MediaStream {}

interface MediaFrame {
  stream: MediaStream;
}

// function createDemuxer(av: LibAVModule): TransformStream<ArrayBufferView, MediaFrame> {
//   const inputTransform = new TransformStream();
//   return new TransformStream({
//     transform(chunk, controller) {

//     }
//   })
// }

function createDemuxer(
  av: LibAVModule
): TransformStream<Uint8Array, Uint8Array> {
  const inputTransform = new TransformStream<
    ArrayBufferView,
    ArrayBufferView
  >();
  // const readable: UnderlyingByteSource & {
  //   ctx: AVFormatContextPtr;
  //   packet: AVPacketPtr;
  // } = {
  //   ctx: NULLPTR,
  //   packet: NULLPTR,
  //   start() {
  //     return av
  //       .avformat_open_input_stream(inputTransform.readable)
  //       .then((c) => {
  //         this.ctx = c;
  //         this.packet = av.av_packet_alloc();
  //         if (!this.packet) {
  //           throw new Error("Unable to allocate packet");
  //         }
  //       });
  //   },
  //   async pull(controller) {
  //     if ((await av.av_read_frame(this.ctx, this.packet)) >= 0) {
  //       const [data, size] = [
  //         av._AVPacket_data(this.packet),
  //         av._AVPacket_size(this.packet),
  //       ];
  //       const buf = av.HEAPU8.subarray(data, data + size);
  //       if (controller.byobRequest) {
  //         const view = controller.byobRequest.view!;
  //         const outSize = Math.min(view.byteLength, size);
  //         new Uint8Array(view.buffer, view.byteOffset, outSize).set(buf);
  //         controller.byobRequest.respond(outSize);
  //       } else {
  //         controller.enqueue(buf.slice());
  //       }
  //       av._av_packet_unref(this.packet);
  //       return;
  //     }
  //     controller.close();
  //   },
  //   type: "bytes",
  //   autoAllocateChunkSize: 4096,
  // };
  const transformer: Transformer<ArrayBufferView, Uint8Array> & {
    writer: WritableStreamDefaultWriter;
    complete?: Promise<void>;
  } = {
    writer: inputTransform.writable.getWriter(),
    start(controller) {
      this.complete = av
        .avformat_open_input_stream(inputTransform.readable)
        .then(async (ctx) => {
          const packet = av.av_packet_alloc();
          if (!packet) {
            throw new Error("Unable to allocate packet");
          }
          while ((await av.av_read_frame(ctx, packet)) >= 0) {
            const [data, size] = [
              av._AVPacket_data(packet),
              av._AVPacket_size(packet),
            ];
            const buf = av.HEAPU8.slice(data, data + size);
            controller.enqueue(buf);
          }
        });
    },
    transform(chunk) {
      return this.writer.write(chunk);
    },
    async flush() {
      await this.writer.close();
      await this.complete;
    },
  };
  return new TransformStream(transformer);
}

export const demuxer = async () =>
  createDemuxer(
    await LibAVFactory({
      wasmBinary: await fetch(wasmUrl).then((r) => r.arrayBuffer()),
    })
  );

export { Decoder, createDemuxer };
