import LibAVFactory, { type LibAV } from "libav.js";

class Decoder {
  private constructor(private readonly av: LibAV) {}

  public async decode(buf: ArrayBuffer) {
    const ret: AudioData[] = [];
    const decoder = new AudioDecoder({
      output: (audioData) => ret.push(audioData),
      error: console.error,
    });
    await this.av.writeFile("tmpfile", new Uint8Array(buf));
    const [fmtCtx, [stream]] = await this.av.ff_init_demuxer_file("tmpfile");
    const timeBase_us =
      (stream.time_base_num * 1000 * 1000) / stream.time_base_den;
    decoder.configure({
      codec: "opus",
      numberOfChannels: await this.av.AVCodecParameters_channels(
        stream.codecpar
      ),
      sampleRate: await this.av.AVCodecParameters_sample_rate(stream.codecpar),
    });

    const packet = await this.av.av_packet_alloc();
    while ((await this.av.av_read_frame(fmtCtx, packet)) >= 0) {
      // const [data, size, pts, duration] = await Promise.all([
      //   this.av.AVPacket_data(packet),
      //   this.av.AVPacket_size(packet),
      //   this.av.AVPacket_pts(packet),
      //   this.av.AVPacket_duration(packet),
      // ]);
      const { data, pts, duration } = await this.av.ff_copyout_packet(packet);
      decoder.decode(
        new EncodedAudioChunk({
          // data: this.av.HEAPU8.subarray(data, data + size),
          data,
          timestamp: pts ?? 0 * timeBase_us,
          type: "key",
          duration: duration ?? 0 * timeBase_us,
        })
      );
      this.av.av_packet_unref(packet);
    }
    await decoder.flush();
    return ret;
  }

  // #onDecode = (audioData: AudioData) => {};
  // #decoder = new AudioDecoder({
  //   output: this.#onDecode,
  //   error: (err) => console.error(err),
  // });

  public static async create() {
    return new Decoder(await LibAVFactory.LibAV());
  }
}

export { Decoder };
