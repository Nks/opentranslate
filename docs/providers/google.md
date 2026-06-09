# Google Cloud Translation Provider

OpenTranslate Desktop supports Google Cloud Translation as a built-in provider.

---

## Authentication modes

Pick one of two authentication modes in **Settings > Providers > Google Cloud
Translation > Authentication**:

| Mode | Identity | Editions unlocked | Document translation |
|---|---|---|---|
| **Service account JSON** | Service account key (`client_email`, `private_key`, `project_id`) | Basic (v2) + Advanced (v3) | Not yet — pending v3 flow (architecture §8.2.5 / §8.7.1) |
| **API key** | A v2-scoped API key string | Basic (v2) only | No |

Mode-specific fields show or hide automatically: `credentialsJsonPath` and the
`edition` selector only appear in service-account mode; the API key field
under **Credentials** only takes effect when API-key mode is active.

---

## Editions

| Edition | API | Document Translation | Location Required |
|---|---|---|---|
| **Basic** | Cloud Translation v2 | No | No |
| **Advanced** | Cloud Translation v3 | Not yet — v3 doc flow stubbed | Yes (for text translation) |

Advanced is only reachable in service-account mode; API-key mode is locked to
Basic / v2.

---

## Configuration

Settings are managed in **Settings > Providers > Google Cloud Translation**.

| Field | Type | Required | Notes |
|---|---|---|---|
| `authMode` | `service-account` or `api-key` | Yes | Default: `service-account` |
| `projectId` | string | Yes | Google Cloud project ID |
| `credentialsJsonPath` | file path | Service account only | Picked via Browse… button |
| `apiKey` | secret string | API-key mode only | Stored in `safeStorage` |
| `edition` | `basic` or `advanced` | Service account only | Default: `basic` |
| `location` | string | Advanced only | GCP region, e.g. `us-central1` |
| `requestTimeoutMs` | number | No | HTTP timeout in ms (default: 15000) |

### Service account JSON

1. Go to [Google Cloud Console > IAM > Service Accounts](https://console.cloud.google.com/iam-admin/serviceaccounts)
2. Create a service account (or pick an existing one).
3. Grant the **Cloud Translation API User** role.
4. Create a JSON key and download it to your machine.
5. In **Settings > Providers > Google Cloud Translation**, choose
   **Authentication: Service account JSON**, then click **Browse…** next to
   **Service account credentials**. The file picker validates the JSON in the
   main process and rejects files that fail to parse or are missing any of
   the required keys: `client_email`, `private_key`, `project_id`.

Only the **file path** is persisted in settings today; the JSON contents stay
on disk. A future change (backlog **B-052**) will persist the parsed
credentials through `safeStorage` and stop tracking the source path.

To switch from API-key back to service-account, re-Browse the JSON file
(the path is cleared when the auth mode changes).

### API key

1. Go to [Google Cloud Console > APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials)
   and create an API key. Restrict it to the **Cloud Translation API**.
2. In **Settings > Providers > Google Cloud Translation**, choose
   **Authentication: API key (Basic / v2 only)** and paste the key into the
   **Google Cloud API key** field under Credentials. The key is encrypted
   through `safeStorage` and never crosses back to the renderer.

API-key mode appends `?key=<APIKEY>` to every Cloud Translation v2 request and
skips the bearer Authorization header. Editions and location selectors are
hidden because v3 (Advanced) does not accept API-key auth.

A second future change (backlog **B-053**) will add OAuth client JSON support
(installed-app flow with consent screen, loopback redirect, code exchange,
refresh-token storage) as a third authentication option.

### Enable the API

The Cloud Translation API must be enabled in your Google Cloud project:

1. Go to [Cloud Translation API](https://console.cloud.google.com/apis/library/translate.googleapis.com)
2. Click **Enable**

---

## Capabilities

| Capability | Basic (SA or API key) | Advanced (SA only) |
|---|---|---|
| Text translation | Yes | Yes |
| Language detection | Yes | Yes |
| Supported languages discovery | Yes | Yes |
| Document translation | No | Not yet — v3 doc flow stubbed |

The Google adapter currently reports `documentTranslation: false` for every
authentication mode + edition combination. The v3 Advanced document endpoint
is a "not yet implemented" stub (architecture §8.2.5 / §8.7.1); enabling the
capability without the actual call would expose a fake capability per
AGENTS.md provider rule 6.

When the v3 doc flow lands the gate will check: `authMode = service-account`,
`edition = advanced`, `location` set to a valid GCP region, and a successful
probe of the Advanced document endpoint.

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

- API-key mode is restricted to v2 Basic; Advanced and document translation
  require service-account mode.
- The picked service-account JSON path is persisted, not the file contents.
  See backlog **B-052** for the planned switch to `safeStorage`-encrypted
  credential contents.
- OAuth installed-app authentication is not yet supported; see backlog
  **B-053**.
- Billing must be enabled on the Google Cloud project.
