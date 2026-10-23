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

## Document Translation

When `/frontend/settings` reports `filesTranslation` with a non-empty
`supportedFilesFormat` (for example `.txt`, `.odt`, `.docx`, `.pdf`), the
Documents page is enabled and lists those formats. The app never assumes a
format: a file whose extension the deployment does not list is rejected
before upload with `unsupported_document_type` and the supported formats.

Flow (all in the main process):

1. Pick a file with the native dialog (filtered by the deployment's
   formats) or drop it anywhere on the Documents page. Only that selected
   file can be translated, and only with the provider that was active when
   it was selected.
2. A raw network path (`\\host\share\…` or `//host/…`) is refused before
   any file access; mapped drives and folders the user picks are accepted.
   The file must be a regular non-empty file, at most **50 MiB**. A
   deployment without `/frontend/settings` (404) counts as unsupported.
3. `POST /translate_file` (multipart `file`, `source`, `target`, and
   `api_key` when configured). Redirects are not followed.
4. The returned `translatedFileUrl` is downloaded only if it is on the
   **same origin** as the configured endpoint (scheme, host, port). The
   download carries no API key and its body is capped at **100 MiB**.
   Other responses are capped too (JSON 1 MiB, error bodies 64 KiB), and
   server error text is shortened to 200 characters.
5. The bytes are saved unmodified next to the source as
   `<name>.<target>.translated<ext>`, marked as downloaded from the internet
   (Windows `Zone.Identifier`, macOS quarantine); an existing translation
   with that name is replaced.

Uploads and downloads time out after `max(requestTimeoutMs, 5 min)`.
There is no cancel button yet.

> **Reverse proxies:** LibreTranslate builds `translatedFileUrl` from the
> request it received. If a TLS-terminating proxy makes it answer with
> `http://…` while the endpoint is `https://…`, or with an internal host
> name, the origin check refuses the download
> (`invalid_provider_response`). Forward the original `Host` header and
> make the server trust the proxy's `X-Forwarded-Proto` (the Docker image
> runs gunicorn: set `FORWARDED_ALLOW_IPS`) so the URL matches the public
> endpoint.
>
> **Redirects:** the app never follows HTTP redirects for any LibreTranslate
> request. If the endpoint redirects (for example `http://` → `https://`),
> requests fail with "endpoint answered with a redirect"; enter the final
> URL in Settings.

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
| 400 `file format not supported` | `UnsupportedDocumentType` |
| 403 `Files translation are disabled …` | `UnsupportedDocumentType` |
| `translatedFileUrl` on another origin, download too large | `InvalidProviderResponse` |
| 500+ | `EndpointUnreachable` |
| TLS/certificate error | `TlsCertificateError` |

---

## Limitations

- Language list depends on which models are installed on the LibreTranslate
  instance. Not all instances support all languages.
- Document translation availability varies by deployment.
- Some public instances enforce strict rate limits.
- The `targets` field in `/languages` response determines which language
  pairs are valid. The app respects these constraints.
