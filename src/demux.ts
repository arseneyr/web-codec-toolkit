import {
  AVFormatContextPtr,
  AVPacketPtr,
  LibAVModule,
  NULLPTR,
} from "libav.js";
import { ShutdownAwareTransformStream } from "./shutdown_aware_transform_stream.js";

interface MediaStream {
  id: number;
  channels: number;
  sample_rate: number;
  time_base: { num: number; den: number };
}

export interface MediaFrame {
  stream: MediaStream;
  data: Uint8Array;
  presentation_timestamp_seconds: number;
  duration_seconds: number;
}

function timeBaseToSeconds(
  value: number,
  timeBase: { num: number; den: number }
): number {
  return (value * timeBase.num) / timeBase.den;
}

function createDemuxer(
  av: LibAVModule
): TransformStream<AllowSharedBufferSource, MediaFrame> {
  function getStreams(fmt_ctx: AVFormatContextPtr): MediaStream[] {
    const numStreams = av.AVFormatContext_nb_streams(fmt_ctx);
    return Array.from({ length: numStreams }, (_, i) => {
      const stream = av.AVFormatContext_streams_a(fmt_ctx, i);
      const codecParams = av.AVStream_codecpar(stream);
      return {
        id: i,
        channels: av.AVCodecParameters_channels(codecParams),
        sample_rate: av.AVCodecParameters_sample_rate(codecParams),
        time_base: av.AVStream_time_base(stream),
      };
    });
  }

  const inputTransform = new TransformStream<ArrayBufferView, ArrayBufferView>(
    undefined,
    new ByteLengthQueuingStrategy({ highWaterMark: 4096 })
  );
  const writer = inputTransform.writable.getWriter();
  let packet: AVPacketPtr = NULLPTR;
  let streams: MediaStream[];
  let complete: Promise<void>;
  let closed = false;
  return new ShutdownAwareTransformStream<AllowSharedBufferSource, MediaFrame>({
    transformer: {
      start(controller) {
        packet = av.av_packet_alloc();
        if (packet == NULLPTR) {
          throw new Error("Unable to allocate packet");
        }
        complete = av
          .avformat_open_input_stream(inputTransform.readable)
          .then(async (ctx) => {
            streams = getStreams(ctx);
            while ((await av.av_read_frame(ctx, packet)) === 0) {
              const [data, size] = [
                av.AVPacket_data(packet),
                av.AVPacket_size(packet),
              ];
              const stream = streams[av.AVPacket_stream_index(packet)];
              controller.enqueue({
                stream,
                data: av.HEAPU8.slice(data, data + size),
                presentation_timestamp_seconds: timeBaseToSeconds(
                  av.AVPacket_pts(packet),
                  stream.time_base
                ),
                duration_seconds: timeBaseToSeconds(
                  av.AVPacket_duration(packet),
                  stream.time_base
                ),
              });
            }
            return av.avformat_close_input(ctx);
          })
          .catch((err) => controller.error(err));
      },
      async transform(chunk) {
        await writer.ready;
        return writer.write(
          chunk instanceof ArrayBuffer ? new Uint8Array(chunk) : chunk
        );
      },
      async flush() {
        await writer.close();
        await complete;
        closed = true;
      },
      async close() {
        if (!closed) {
          await writer.close();
          await complete;
        }
      },
    },
    writableStrategy: {
      highWaterMark: 4096,
      size: (chunk) => chunk.byteLength,
    },
    readableStrategy: {
      highWaterMark: 4096,
      size: (chunk) => chunk.data.byteLength,
    },
  });
}
export { createDemuxer };
