# Docker WireGuard API

A Docker image that extends [linuxserver/docker-wireguard](https://github.com/linuxserver/docker-wireguard) with a simple REST API for dynamic peer management.

> [!WARNING]  
> Under development

```bash
docker pull ghcr.io/woltsu/docker-wireguard-api:latest
```

## Features

- Add/remove WireGuard peers via HTTP API
- Automatic IP allocation from subnet
- API key authentication
- Runs alongside WireGuard in a single container

## WireGuard API Environment Variables

> [!NOTE]
> These are _in addition_ to the standard [linuxserver/docker-wireguard](https://github.com/linuxserver/docker-wireguard#parameters) environment variables.
> 
> See [`docker-compose.yml`](./docker-compose.yml) for an example setup.

```bash
WG_API_KEY=your-32-character-api-key-here
WG_CONFIG_PATH=/config/wg_confs/wg0.conf
WG_INTERFACE=wg0
WG_API_PORT=3000
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

**Response:**
```json
{
  "client": {
    "privateKey": "...",
    "publicKey": "...",
    "presharedKey": "..."
  },
  "peer": {
    "allowedIPs": "..."
  }
}
```

### Delete Client
```bash
curl -X DELETE -H "X-API-Key: ${WG_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"publicKey": "PUBLIC_KEY_HERE"}' \
  http://localhost:3000/wg/client
```

**Response:**
```json
{
  "publicKey": "..."
}
```

## Authentication

API key required via:
- Header: `X-API-Key: your-key`
- Header: `Authorization: Bearer your-key`

Minimum 32 characters required.

## License

MIT

