# Google Cloud Translation Provider

OpenTranslate Desktop supports Google Cloud Translation as a built-in provider.

---

## Editions

| Edition | API | Document Translation | Location Required |
|---|---|---|---|
| **Basic** | Cloud Translation v2 | No | No |
| **Advanced** | Cloud Translation v3 | Yes (when location set) | Yes |

---

## Configuration

Settings are managed in **Settings > Providers > Google Cloud Translation**.

| Field | Type | Required | Description |
|---|---|---|---|
| `projectId` | string | Yes | Google Cloud project ID |
| `credentialsJsonPath` | file path | Yes | Path to service account JSON key file |
| `edition` | `basic` or `advanced` | Yes | API edition (default: `basic`) |
| `location` | string | Advanced only | GCP region (e.g., `us-central1`). Required for document translation |
| `requestTimeoutMs` | number | No | HTTP timeout in milliseconds (default: 10000) |

### Credentials

Google Cloud Translation requires a **service account JSON key** file:

1. Go to [Google Cloud Console > IAM > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Create a service account (or use an existing one)
3. Grant the **Cloud Translation API User** role
4. Create a JSON key and download it
5. In OpenTranslate Desktop, set `credentialsJsonPath` to the downloaded file

The JSON key is **never** sent to the renderer process. It is read by the
main process at translation time and used to authenticate via `google-auth-library`.

### Enable the API

The Cloud Translation API must be enabled in your Google Cloud project:

1. Go to [Cloud Translation API](https://console.cloud.google.com/apis/library/translate.googleapis.com)
2. Click **Enable**

---

## Capabilities

| Capability | Basic | Advanced |
|---|---|---|
| Text translation | Yes | Yes |
| Language detection | Yes | Yes |
| Supported languages discovery | Yes | Yes |
| Document translation | No | Yes (with location) |

Document translation requires:
- `edition` set to `advanced`
- `location` set to a valid GCP region
- The Advanced endpoint must respond successfully to a capability probe

---

## Error Mapping

Google-specific errors are mapped to shared error categories:

| Google Error | Error Category |
|---|---|
| `PERMISSION_DENIED` | `AuthenticationFailed` |
| `UNAUTHENTICATED` | `AuthenticationFailed` |
| `RESOURCE_EXHAUSTED` | `QuotaExceeded` |
| `INVALID_ARGUMENT` | `UnsupportedLanguage` or `InvalidProviderResponse` |
| `UNAVAILABLE` | `EndpointUnreachable` |

---

## Limitations

- Service account JSON is the only supported authentication method.
  API key support is planned (see backlog B-012).
- Document translation via the v3 endpoint is capability-gated but the
  actual HTTP call is not yet implemented (stub returns error).
- Billing must be enabled on the Google Cloud project.
