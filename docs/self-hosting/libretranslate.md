# Self-Hosting LibreTranslate

This guide covers running a local LibreTranslate instance for use with
OpenTranslate Desktop.

---

## Docker (recommended)

The project includes a `docker-compose.yml` for LibreTranslate.

### Start

```bash
docker compose up -d
```

Default configuration:
- Port: `5050` (mapped from container port 5000)
- No API key required
- All language models downloaded on first start

### Stop

```bash
docker compose down
```

### Configuration

The `docker-compose.yml` can be customized:

```yaml
services:
  libretranslate:
    image: libretranslate/libretranslate:latest
    ports:
      - "5050:5000"
    environment:
      - LT_LOAD_ONLY=en,es,fr,de,uk
      - LT_API_KEYS=false
    volumes:
      - lt-data:/home/libretranslate/.local
```

| Variable | Description |
|---|---|
| `LT_LOAD_ONLY` | Comma-separated language codes to load (reduces memory) |
| `LT_API_KEYS` | `true` to require API keys, `false` to allow anonymous |
| `LT_CHAR_LIMIT` | Max characters per request (default: unlimited) |
| `LT_SUGGESTIONS` | `true` to enable translation suggestions |
| `LT_DISABLE_WEB_UI` | `true` to disable the web interface |

### First Start

The first start downloads language models (~1-2 GB depending on languages).
This may take several minutes. Subsequent starts are fast.

### Verify

```bash
curl http://localhost:5050/languages
```

Should return a JSON array of supported languages.

---

## Without Docker

### Requirements

- Python 3.8+
- pip

### Install

```bash
pip install libretranslate
```

### Run

```bash
libretranslate --port 5000 --host 0.0.0.0
```

### Options

```bash
libretranslate --help
```

Key options:
- `--load-only en,es,fr` — limit loaded languages
- `--api-keys` — require API keys
- `--char-limit 5000` — limit request size
- `--ssl` — enable HTTPS (provide cert/key paths)

---

## Connect from OpenTranslate Desktop

1. Open **Settings > Providers > LibreTranslate**
2. Set **Endpoint** to `http://localhost:5050` (or your deployment URL)
3. Leave **API Key** empty (unless your instance requires it)
4. Click **Test Connection** to verify

If using HTTPS with a self-signed certificate, enable **Allow self-signed TLS**.

---

## Resource Requirements

| Languages | RAM (approximate) | Disk |
|---|---|---|
| 2-3 | ~1 GB | ~500 MB |
| 5-10 | ~2 GB | ~1 GB |
| All (~30) | ~4-6 GB | ~3 GB |

Reduce memory by loading only the languages you need via `LT_LOAD_ONLY`.

---

## Troubleshooting

### Port 5000 occupied (macOS)

macOS uses port 5000 for AirPlay Receiver. Use port 5050 or disable
AirPlay Receiver in System Settings > General > AirDrop & Handoff.

### 403 Forbidden

The instance requires an API key. Either:
- Set `LT_API_KEYS=false` in Docker environment
- Or generate a key and enter it in OpenTranslate Desktop settings

### Slow first translation

Language models are loaded on demand. The first translation for a
language pair may take a few seconds while the model loads.

### Connection refused

Verify the instance is running:

```bash
curl http://localhost:5050/languages
```

Check that the port mapping matches your OpenTranslate Desktop endpoint setting.
