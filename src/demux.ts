import LibAVFactory, { type LibAV } from "libav.js";

class Decoder {
  private constructor(private readonly av: LibAV) {}

  public async decode(buf: ArrayBuffer) {
    const ret: LibAV.Packet[] = [];
    await this.av.writeFile("tmpfile", new Uint8Array(buf));
    const [fmtCtx, [stream]] = await this.av.ff_init_demuxer_file("tmpfile");
    const timeBase_us =
      (stream.time_base_num * 1000 * 1000) / stream.time_base_den;
    this.#decoder.configure({
      codec: "opus",
      numberOfChannels: await this.av.AVCodecParameters_channels(
        stream.codecpar
      ),
      sampleRate: await this.av.AVCodecParameters_sample_rate(stream.codecpar),
    });

    const packet = await this.av.av_packet_alloc();
    while ((await this.av.av_read_frame(fmtCtx, packet)) >= 0) {
      ret.push(await this.av.ff_copyout_packet(packet));
      this.av.av_packet_unref(packet);
    }
  }

  #onDecode = (audioData: AudioData) => {};
  #decoder = new AudioDecoder({
    output: this.#onDecode,
    error: (err) => console.error(err),
  });

  public static async create() {
    return new Decoder(await LibAVFactory.LibAV());
  }
}

export { Decoder };
