/*
MIT License

Copyright (c) 2021 Hal Blackburn

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

import { Deferred, deferred } from "./deferred.js";

type ShutdownMonitorWritableStreamOptions<W = unknown> = {
  queuingStrategy?: QueuingStrategy<W>;
};

class ShutdownMonitorWritableStream<W = unknown> extends WritableStream<W> {
  readonly #monitoredWritable: Deferred<WritableStream<W>>;
  #monitoredWriter: WritableStreamDefaultWriter<W> | undefined;
  constructor(options?: ShutdownMonitorWritableStreamOptions<W>) {
    const monitoredWritable: Deferred<WritableStream<W>> = deferred();
    super(
      {
        start: async (controller) => {
          await monitoredWritable;
          this.#monitoredWriter!.closed.catch(
            controller.error.bind(controller)
          );
        },
        abort: (reason: unknown) => {
          return this.#monitoredWriter!.abort(reason);
        },
        close: () => {
          return this.#monitoredWriter!.close();
        },
        write: (chunk: W) => {
          // There's perhaps a surprising amount of nuance to returning (or not
          // returning) the promise from the monitored writer. There are basically
          // two choices. Either we:
          //   a: return it
          //   b: await this.#monitoredWriter.ready and then catch and ignore the
          //      promise from this.#monitoredWriter.write().
          // By taking option a we cause the chunk buffer/queue of the monitored
          // stream not to be used, because our queue will not begin executing a
          // write until the previous write's promise has resolved.
          // Normally when using a stream's writer, this would be undesirable, and
          // indeed the streams spec explicity warns against it:
          //   https://streams.spec.whatwg.org/#example-manual-write-dont-await
          // However, because we're explicitly proxying another stream, it is the
          // behaviour we want:
          //  - Unlike option b, it makes our write() reject when the monitored
          //    stream's write() rejects.
          //  - Because it nullifies the monitored stream's queue, introducing
          //    this additional wrapper stream in a pipelines does NOT result in
          //    additional queueing capacity being created in the pipeline. This
          //    doesn't matter in practice (unless the exact number of in-flight
          //    chunks really matters for some reason), but it does make the
          //    wrapper's presence transparent, which is nice.
          // A possible downside is that if the monitored stream does define a
          // queueing strategy, the strategy needs to be assigned to this monitor
          // queue for it to take effect.
          return this.#monitoredWriter!.write(chunk);
        },
      },
      options && options.queuingStrategy
    );
    this.#monitoredWritable = monitoredWritable;
  }

  pipeTo(destination: WritableStream<W>): Promise<void> {
    if (this.#monitoredWriter !== undefined) {
      throw new TypeError(
        "Failed to pipeTo destination: this stream is already pipedTo a destination"
      );
    }
    this.#monitoredWriter = destination.getWriter();
    this.#monitoredWritable.resolve(destination);
    return this.#monitoredWriter.closed;
  }
}

/** Used by a `ShutdownAwareTransformer` to interact with its stream.
 *
 * It behaves in the same way as a normal `TransformStream` Controller, except
 * that it has a `signal` property. `signal` is an `AbortSignal` that triggers
 * when the underlying stream is aborted.
 *
 * * https://streams.spec.whatwg.org/#transformer-api
 * * https://developer.mozilla.org/en-US/docs/Web/API/TransformStreamDefaultController
 * * This API mirrors the Controller of `WritableStream`, which also exposes a
 *   `signal` property: https://streams.spec.whatwg.org/#writablestreamdefaultcontroller
 */
export interface ShutdownAwareTransformStreamController<O = unknown>
  extends TransformStreamDefaultController<O> {
  readonly signal: AbortSignal;
}

/** An object that defines the behaviour of a `ShutdownAwareTransformStream`.
 *
 * It behaves in the same way as a normal `TransformStream` Transformer,
 * except that it can have a `close()` method, and the Controller received by
 * its methods is a `ShutdownAwareTransformStreamController`.
 *
 * * https://streams.spec.whatwg.org/#transformer-api
 * * https://developer.mozilla.org/en-US/docs/Web/API/TransformStream/TransformStream
 */
export interface ShutdownAwareTransformer<I = unknown, O = unknown> {
  readableType?: never;
  writableType?: never;
  /** Called when the stream is created, before any other Transformer methods. */
  start?: (
    controller: ShutdownAwareTransformStreamController<O>
  ) => void | PromiseLike<void>;
  /** Called after the final chunk has been processed by `transform()`. */
  flush?: (
    controller: ShutdownAwareTransformStreamController<O>
  ) => void | PromiseLike<void>;
  /** Called with each chunk passing through the stream. */
  transform?: (
    chunk: I,
    controller: ShutdownAwareTransformStreamController<O>
  ) => void | PromiseLike<void>;
  /** Called when the stream has shutdown, either due to an error or end-of-input.
   *
   * Never called more than once, even if an error occurs as the stream closes
   * from end-of-input. To distinguish between end-of-input and stream errors,
   * `controller.signal.aborted` will be true when an error occured, and
   * `controller.signal.reason` will be the error.
   */
  close?: () => void;
}

/** Constructor options for `ShutdownAwareTransformStream`. */
export interface ShutdownAwareTransformStreamOptions<I = unknown, O = unknown> {
  /** The Transformer object defining the stream's behaviour. */
  transformer?: ShutdownAwareTransformer<I, O>;
  /** The `QueuingStrategy` for the writable side of the stream. */
  writableStrategy?: QueuingStrategy<I>;
  /** The `QueuingStrategy` for the readable side of the stream. */
  readableStrategy?: QueuingStrategy<O>;
}

/**
 * A `TransformStream` that allows its Transformer to be notified when the
 * stream has shutdown, either due to an error or from end-of-input.
 *
 * The standard `TransformStream` does not support notifying its Transformer
 * if the stream encounters an error.
 *
 * To be notified of stream shutdown, either provide a `close()` method on the
 * Transformer object, or register a listener on the Controller's `signal`
 * property (an [`AbortSignal`]) in the Transformer's `start()` method:
 *
 * [`AbortSignal`]: https://developer.mozilla.org/en-US/docs/Web/API/AbortSignal
 *
 * ```typescript
 * new ShutdownAwareTransformStream({
 *   transformer: {
 *     start(controller) {
 *       controller.signal.addEventListener(
 *         "abort",
 *         () => console.log("stream aborted"),
 *       );
 *     },
 *     close() {
 *       console.log("stream has shutdown");
 *     },
 *     transform(chunk, controller) {
 *       // ...
 *     },
 *   },
 * });
 * ```
 */
export class ShutdownAwareTransformStream<I = unknown, O = unknown>
  implements TransformStream<I, O>
{
  readonly #monitor: ShutdownMonitorWritableStream<I>;
  readonly #abortController: AbortController;
  readonly #transformer: ShutdownAwareTransformerAdapter<I, O>;
  readonly #transformStream: TransformStream<I, O>;
  readonly #transformMonitorPipe: Promise<void>;
  /** Note that arguments are passed as an object rather than individually
   * (unlike a standard `TransformStream`).
   */
  constructor(options: ShutdownAwareTransformStreamOptions<I, O> = {}) {
    this.#monitor = new ShutdownMonitorWritableStream({
      queuingStrategy: options.writableStrategy,
    });
    this.#abortController = new AbortController();
    this.#transformer = new ShutdownAwareTransformerAdapter<I, O>(
      this.#abortController.signal,
      options.transformer ?? {}
    );
    this.#transformStream = new TransformStream<I, O>(
      this.#transformer,
      undefined,
      options.readableStrategy
    );
    this.#transformMonitorPipe = this.#monitor.pipeTo(
      this.#transformStream.writable
    );
    this.#transformMonitorPipe.catch((reason) => {
      this.#abortController.abort(reason);
    });
  }
  get readable(): ReadableStream<O> {
    return this.#transformStream.readable;
  }
  get writable(): WritableStream<I> {
    return this.#monitor;
  }
}

class ShutdownAwareTransformStreamDefaultController<O>
  implements ShutdownAwareTransformStreamController<O>
{
  constructor(
    readonly signal: AbortSignal,
    private readonly controller: TransformStreamDefaultController<O>
  ) {}
  get desiredSize(): number | null {
    return this.controller.desiredSize;
  }
  enqueue(chunk: O) {
    this.controller.enqueue(chunk);
  }
  error(reason?: unknown) {
    this.controller.error(reason);
  }
  terminate() {
    this.controller.terminate();
  }
}

class ShutdownAwareTransformerAdapter<I, O> implements Transformer<I, O> {
  #signal: AbortSignal;
  #transformer: ShutdownAwareTransformer<I, O>;
  #controller: undefined | ShutdownAwareTransformStreamController<O> =
    undefined;
  readonly transform: Transformer<I, O>["transform"];
  #closeTransformerIfNotAlreadyClosed = (() => {
    let closeCalled = false;
    return () => {
      if (!closeCalled) {
        closeCalled = true;
        this.#transformer.close && this.#transformer.close();
      }
    };
  })();
  constructor(
    signal: AbortSignal,
    transformer: ShutdownAwareTransformer<I, O>
  ) {
    this.#signal = signal;
    this.#transformer = transformer;
    signal.addEventListener("abort", this.#closeTransformerIfNotAlreadyClosed);
    // In order to inherit the no-op transform behaviour of TransformStream,
    // only define transform() if the wrapped transformer does.
    if (transformer.transform) {
      const transform = transformer.transform.bind(transformer);
      this.transform = (
        chunk: I,
        _controller: TransformStreamDefaultController<O>
      ): void | PromiseLike<void> => {
        return transform(chunk, this.#controller!);
      };
    }
  }

  start(
    controller: TransformStreamDefaultController<O>
  ): void | PromiseLike<void> {
    this.#controller = new ShutdownAwareTransformStreamDefaultController<O>(
      this.#signal,
      controller
    );
    return this.#transformer.start && this.#transformer.start(this.#controller);
  }
  flush(
    _controller: TransformStreamDefaultController<O>
  ): void | PromiseLike<void> {
    // If flush() throws synchronously, the stream errors and close() is called
    // via this.#signal. Note that if flush calls controller.error() and returns
    // synchronously then close() will be called before the underlying transform
    // stream becomes errored.
    return Promise.resolve(
      this.#transformer.flush && this.#transformer.flush(this.#controller!)
    ).then(this.#closeTransformerIfNotAlreadyClosed);
  }
}
