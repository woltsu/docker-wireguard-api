# WireGuard API

Extends [linuxserver/docker-wireguard](https://github.com/linuxserver/docker-wireguard) with a REST API for dynamic peer management.

## Features

- Add/remove WireGuard peers via HTTP API
- Automatic IP allocation from subnet
- API key authentication
- Runs alongside WireGuard in a single container

## Quick Start

```bash
docker-compose up -d
```

Or pull the pre-built image from GitHub Container Registry:
```bash
docker pull ghcr.io/OWNER/wireguard-api:latest
```

## Required Environment Variables

```bash
WG_API_KEY=your-32-character-api-key-here
WG_CONFIG_PATH=/config/wg_confs/wg0.conf
WG_INTERFACE=wg0
INTERNAL_SUBNET=10.13.0.0/16
```

## API Endpoints

### Get WireGuard Status
```bash
curl -H "X-API-Key: ${WG_API_KEY}" http://localhost:3000/wg
```

### Create Client
```bash
curl -X POST -H "X-API-Key: ${WG_API_KEY}" http://localhost:3000/wg/client
```

### Delete Client
```bash
curl -X DELETE -H "X-API-Key: ${WG_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"publicKey": "PUBLIC_KEY_HERE"}' \
  http://localhost:3000/wg/client
```

## Authentication

API key required via:
- Header: `X-API-Key: your-key`
- Header: `Authorization: Bearer your-key`

Minimum 32 characters required.

## License

MIT

