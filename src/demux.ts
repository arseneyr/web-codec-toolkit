import { LibAVModule } from "libav.js/lite";

interface MediaStream {}

interface MediaFrame {
  stream: MediaStream;
}

function createDemuxer(
  av: LibAVModule
): TransformStream<Uint8Array, Uint8Array> {
  const inputTransform = new TransformStream<
    ArrayBufferView,
    ArrayBufferView
  >();
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
            controller.enqueue(av.HEAPU8.slice(data, data + size));
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
export async function* streamAsyncIterator<T>(
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

export { createDemuxer };
