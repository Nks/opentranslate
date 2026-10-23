import {
  createServer, type IncomingMessage, type Server, type ServerResponse,
} from 'node:http'
import type { AddressInfo } from 'node:net'

type UploadedFile = Blob & { name: string }

export interface RecordedRequest {
  method: string
  path: string
  headers: IncomingMessage['headers']
  form: FormData | null
}

export interface EmulatorScenario {
  supportedFilesFormat: string[]
  uploadStatus: number
  uploadError: string
  translatedFileUrl: ((origin: string, storedName: string) => string) | null
  downloadRedirect: string | null
  translatedBytes: Uint8Array
}

export interface HttpEmulator {
  origin: string
  requests: RecordedRequest[]
  scenario: EmulatorScenario
  close: () => Promise<void>
}

export function defaultScenario(): EmulatorScenario {
  return {
    supportedFilesFormat: ['.txt', '.odt'],
    uploadStatus: 200,
    uploadError: '',
    translatedFileUrl: null,
    downloadRedirect: null,
    translatedBytes: new Uint8Array([0xef, 0xbb, 0xbf, 0xd0, 0x9f, 0x00, 0x0a]),
  }
}

async function readBody(req: IncomingMessage): Promise<Uint8Array<ArrayBuffer>> {
  const chunks: Buffer[] = []

  for await (const chunk of req) {
    chunks.push(chunk as Buffer)
  }

  return new Uint8Array(Buffer.concat(chunks))
}

async function parseForm(
  req: IncomingMessage,
  body: Uint8Array<ArrayBuffer>,
): Promise<FormData | null> {
  const contentType: string = req.headers['content-type'] ?? ''

  if (!contentType.startsWith('multipart/form-data')) {
    return null
  }

  return new Response(body, { headers: { 'content-type': contentType } }).formData()
}

function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

async function route(
  emulator: HttpEmulator,
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  const path: string = req.url ?? '/'
  const body: Uint8Array<ArrayBuffer> = await readBody(req)
  const form: FormData | null = await parseForm(req, body)
  const scenario: EmulatorScenario = emulator.scenario

  emulator.requests.push({
    method: req.method ?? 'GET',
    path,
    headers: req.headers,
    form,
  })

  if (path === '/languages') {
    sendJson(res, 200, [
      {
        code: 'en',
        name: 'English',
        targets: ['ru'],
      },
      {
        code: 'ru',
        name: 'Russian',
        targets: ['en'],
      },
    ])

    return
  }

  if (path === '/frontend/settings') {
    sendJson(res, 200, {
      filesTranslation: scenario.supportedFilesFormat.length > 0,
      supportedFilesFormat: scenario.supportedFilesFormat,
    })

    return
  }

  if (path === '/translate_file') {
    if (scenario.uploadStatus !== 200) {
      sendJson(res, scenario.uploadStatus, { error: scenario.uploadError })

      return
    }

    const file: UploadedFile | null = form?.get('file') as UploadedFile | null
    const storedName: string = `0b9e.${file?.name ?? 'missing'}`
    const url: string = scenario.translatedFileUrl
      ? scenario.translatedFileUrl(emulator.origin, storedName)
      : `${emulator.origin}/download_file/${storedName}`

    sendJson(res, 200, { translatedFileUrl: url })

    return
  }

  if (path.startsWith('/download_file/')) {
    if (scenario.downloadRedirect) {
      res.writeHead(302, { Location: scenario.downloadRedirect })
      res.end()

      return
    }

    res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
    res.end(Buffer.from(scenario.translatedBytes))

    return
  }

  sendJson(res, 404, { error: 'not found' })
}

export async function startEmulator(): Promise<HttpEmulator> {
  const emulator: HttpEmulator = {
    origin: '',
    requests: [],
    scenario: defaultScenario(),
    close: async (): Promise<void> => undefined,
  }
  const server: Server = createServer((req: IncomingMessage, res: ServerResponse): void => {
    void route(emulator, req, res)
  })

  await new Promise<void>((resolve: () => void) => {
    server.listen(0, '127.0.0.1', resolve)
  })

  emulator.origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  emulator.close = (): Promise<void> => new Promise<void>((resolve: () => void) => {
    server.closeAllConnections()
    server.close((): void => resolve())
  })

  return emulator
}
