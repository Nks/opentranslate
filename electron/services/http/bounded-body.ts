export type BoundedBody = {
  kind: 'complete'
  bytes: Uint8Array<ArrayBuffer>
} | {
  kind: 'too-large'
}

export async function readBoundedBody(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<BoundedBody> {
  if (!body) {
    return {
      kind: 'complete',
      bytes: new Uint8Array(0),
    }
  }

  const reader: ReadableStreamDefaultReader<Uint8Array> = body.getReader()
  const chunks: Uint8Array[] = []
  let total: number = 0

  for (;;) {
    const chunk: ReadableStreamReadResult<Uint8Array> = await reader.read()

    if (chunk.done) {
      break
    }

    total += chunk.value.byteLength

    if (total > maxBytes) {
      await reader.cancel()

      return {
        kind: 'too-large',
      }
    }

    chunks.push(chunk.value)
  }

  return {
    kind: 'complete',
    bytes: concatChunks(chunks, total),
  }
}

export function concatChunks(
  chunks: readonly Uint8Array[],
  total: number,
): Uint8Array<ArrayBuffer> {
  const bytes: Uint8Array<ArrayBuffer> = new Uint8Array(total)
  let offset: number = 0

  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  return bytes
}
