import {
  net, protocol,
} from 'electron'
import { existsSync } from 'node:fs'
import {
  isAbsolute, join, relative, resolve,
} from 'node:path'
import { pathToFileURL } from 'node:url'

export const RENDERER_SCHEME = 'app'
export const RENDERER_HOST = 'app'
export const RENDERER_URL = `${RENDERER_SCHEME}://${RENDERER_HOST}/`

export function registerRendererSchemePrivileges(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: RENDERER_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
      },
    },
  ])
}

export function resolveRendererAssetPath(
  rendererDir: string,
  pathname: string,
): string | null {
  const relativeRequest: string = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  const decodedRequest: string = decodeURIComponent(relativeRequest)
  const resolved: string = resolve(rendererDir, decodedRequest)
  const fromRoot: string = relative(rendererDir, resolved)
  const escapesRoot: boolean = fromRoot.startsWith('..') || isAbsolute(fromRoot)

  if (escapesRoot) {
    return null
  }

  return resolved
}

export function registerRendererProtocol(rendererDir: string): void {
  protocol.handle(RENDERER_SCHEME, async (request: Request): Promise<Response> => {
    const {
      host, pathname,
    } = new URL(request.url)

    if (host !== RENDERER_HOST) {
      return new Response('Not Found', {
        status: 404,
      })
    }

    const filePath: string | null = resolveRendererAssetPath(rendererDir, pathname)

    if (filePath === null) {
      return new Response('Forbidden', {
        status: 403,
      })
    }

    if (!existsSync(filePath)) {
      return new Response('Not Found', {
        status: 404,
      })
    }

    return net.fetch(pathToFileURL(filePath).toString())
  })
}

export function rendererDirFromEntry(rendererEntry: string): string {
  return join(rendererEntry, '..')
}
