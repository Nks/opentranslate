export function fakeJsonResponse(status: number, body: unknown): Response {
  const text: string = typeof body === 'string' ? body : JSON.stringify(body ?? null)

  return new Response(text, {
    status,
    statusText: `test ${status}`,
    headers: { 'content-type': 'application/json' },
  })
}
