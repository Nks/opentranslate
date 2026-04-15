import { describe, expect, it } from 'vitest'
import { channels, type ChannelName } from '@electron/ipc/channels'

describe('ipc channel registry', () => {
  it('registers the baseline app:get-version channel', () => {
    expect(channels['app:get-version']).toBe('app:get-version')
  })

  it('registers the baseline app:get-platform channel', () => {
    expect(channels['app:get-platform']).toBe('app:get-platform')
  })

  it('exposes a typed ChannelName union', () => {
    const name: ChannelName = 'app:get-version'
    expect(name).toBe('app:get-version')
  })

  it('has no duplicate channel names', () => {
    const values = Object.values(channels)
    const unique = new Set(values)
    expect(unique.size).toBe(values.length)
  })

  it('namespaces every channel with a colon', () => {
    for (const value of Object.values(channels)) {
      expect(value).toMatch(/^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*$/)
    }
  })
})
