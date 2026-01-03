import { AddPeer } from "./cmd/AddPeer";

export class WireGuardConfigBuilder {
  compilePeerConfig(cmd: AddPeer) {
    const configRows = ["[Peer]"];

    configRows.push(`PublicKey = ${cmd.publicKey}`);

    if (cmd.presharedKey) {
      configRows.push(`PresharedKey = ${cmd.presharedKey}`);
    }

    configRows.push(`AllowedIPs = ${cmd.allowedIPs}`);

    if (cmd.endpoint) {
      configRows.push(`Endpoint = ${cmd.endpoint}`);
    }

    if (cmd.persistentKeepalive) {
      configRows.push(`PersistentKeepalive = ${cmd.persistentKeepalive}`);
    }

    return configRows.join("\n");
  }
}
