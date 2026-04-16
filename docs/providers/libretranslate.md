# LibreTranslate Provider

OpenTranslate Desktop supports LibreTranslate as a built-in provider.

LibreTranslate is an open-source, self-hostable machine translation API.

---

## Configuration

Settings are managed in **Settings > Providers > LibreTranslate**.

| Field | Type | Required | Description |
|---|---|---|---|
| `endpoint` | URL | Yes | LibreTranslate API endpoint (e.g., `http://localhost:5000`) |
| `apiKey` | secret | No | API key (stored in OS secure storage, not settings file) |
| `allowSelfSignedTls` | boolean | No | Accept self-signed TLS certificates (default: `false`) |
| `requestTimeoutMs` | number | No | HTTP timeout in milliseconds (default: 10000) |

### API Key

Some LibreTranslate deployments require an API key. When configured:

- The key is stored using Electron `safeStorage` (OS keychain)
- It is sent as `api_key` form field on each request
- It is **never** exposed to the renderer process

---

## Endpoint Compatibility

LibreTranslate can be used with:

| Deployment | Example Endpoint | Notes |
|---|---|---|
| **Public instance** | `https://libretranslate.com` | May require API key, rate limited |
| **Self-hosted** | `http://localhost:5000` | Full control, no rate limits |
| **Private deployment** | `https://translate.internal.example.com` | Behind VPN/firewall |

The provider validates the endpoint by calling `/languages` on activation.
If the endpoint is unreachable or returns an unexpected response, the
provider reports an error but remains selectable.

---

## Capabilities

| Capability | Supported |
|---|---|
| Text translation | Yes |
| Language detection | Yes |
| Supported languages discovery | Yes |
| Document translation | Runtime-probed |

Document translation support varies by deployment. The provider probes
`/frontend/settings` at runtime to determine if the instance supports
file translation. The UI reflects the actual capability.

---

## API Endpoints Used

| Endpoint | Purpose |
|---|---|
| `GET /languages` | Fetch supported language list |
| `POST /detect` | Detect source language |
| `POST /translate` | Translate text |
| `POST /translate_file` | Translate document (capability-gated) |
| `GET /frontend/settings` | Probe deployment capabilities |

---

## Self-Signed TLS

When connecting to a self-hosted instance with a self-signed certificate,
enable **Allow self-signed TLS** in the provider settings. This creates
a custom `undici.Agent` with `rejectUnauthorized: false`.

> Only enable this for trusted internal deployments. It disables TLS
> certificate validation for this provider only.

---

## Error Mapping

LibreTranslate errors are mapped to shared error categories:

| HTTP Status / Error | Error Category |
|---|---|
| Network failure | `NetworkUnavailable` |
| Connection refused | `EndpointUnreachable` |
| 403 Forbidden | `AuthenticationFailed` |
| 429 Too Many Requests | `RateLimited` |
| 400 with language error | `UnsupportedLanguage` |
| 500+ | `InvalidProviderResponse` |
| TLS/certificate error | `TlsCertificateError` |

---

## Limitations

- Language list depends on which models are installed on the LibreTranslate
  instance. Not all instances support all languages.
- Document translation availability varies by deployment.
- Some public instances enforce strict rate limits.
- The `targets` field in `/languages` response determines which language
  pairs are valid. The app respects these constraints.
