import LibAVFactory, { type LibAV } from "libav.js";

class Decoder {
  private constructor(private readonly av: LibAV) {}

  public async decode(buf: ArrayBuffer) {
    await this.av.writeFile("tmpfile", new Uint8Array(buf));
    const [fmtCtx, streams] = await this.av.ff_init_demuxer_file("tmpfile");
    const packet = await this.av.av_packet_alloc();
  }

  public static async create() {
    return new Decoder(await LibAVFactory.LibAV());
  }
}

export { Decoder };
