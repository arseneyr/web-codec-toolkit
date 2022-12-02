import { MediaFrame } from "./demux.js";

function createWebCodecDecoder(): TransformStream<MediaFrame, AudioData> {
  let decoders: AudioDecoder[] = [];
  const transformer: Transformer<MediaFrame, AudioData> = {
    transform(chunk, controller) {
      let decoder = decoders[chunk.stream.id];
      if (!decoder) {
        decoder = new AudioDecoder({
          output: controller.enqueue.bind(controller),
          error: console.error,
        });
        decoder.configure({
          codec: "opus",
          numberOfChannels: chunk.stream.channels,
          sampleRate: chunk.stream.sample_rate,
        });
        decoders[chunk.stream.id] = decoder;
      }
      decoder.decode(
        new EncodedAudioChunk({
          type: "key",
          data: chunk.data,
          timestamp: chunk.presentation_timestamp_seconds * 1000 * 1000,
          duration: chunk.duration_seconds * 1000 * 1000,
        })
      );
    },
    flush() {
      return Promise.all(
        decoders.map((d) => d.flush().then(() => d.close()))
      ) as Promise<any>;
    },
  };
  return new TransformStream(transformer);
}

export { createWebCodecDecoder };
