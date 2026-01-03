import { AddPeer } from "./cmd/AddPeer";
import { RemovePeer } from "./cmd/RemovePeer";

type PeerSection = {
  publicKey: string;
  presharedKey?: string;
  allowedIPs: string;
  endpoint?: string;
  persistentKeepalive?: number;
  comment?: string;
};

type ConfigAST = {
  interfaceLines: string[];
  peers: PeerSection[];
};

export class WireGuardConfigBuilder {
  private parsePeerSection(
    lines: string[],
    index: number
  ): { peer: PeerSection; nextIndex: number } {
    const peer: Partial<PeerSection> = {};

    let i = index + 1;
    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Stop if we hit a new section
      if (trimmed.startsWith("[")) {
        break;
      }

      // Parse peer properties
      if (trimmed.startsWith("PublicKey = ")) {
        peer.publicKey = trimmed.replace("PublicKey = ", "").trim();
      } else if (trimmed.startsWith("PresharedKey = ")) {
        peer.presharedKey = trimmed.replace("PresharedKey = ", "").trim();
      } else if (trimmed.startsWith("AllowedIPs = ")) {
        peer.allowedIPs = trimmed.replace("AllowedIPs = ", "").trim();
      } else if (trimmed.startsWith("Endpoint = ")) {
        peer.endpoint = trimmed.replace("Endpoint = ", "").trim();
      } else if (trimmed.startsWith("PersistentKeepalive = ")) {
        peer.persistentKeepalive = parseInt(
          trimmed.replace("PersistentKeepalive = ", "").trim(),
          10
        );
      } else if (trimmed.startsWith("#")) {
        peer.comment = trimmed.substring(1).trim();
      }

      i++;
    }

    if (!peer.publicKey || !peer.allowedIPs) {
      throw new Error("Invalid peer section: missing required fields");
    }

    return {
      peer: {
        publicKey: peer.publicKey,
        presharedKey: peer.presharedKey,
        allowedIPs: peer.allowedIPs,
        endpoint: peer.endpoint,
        persistentKeepalive: peer.persistentKeepalive,
        comment: peer.comment,
      },
      nextIndex: i,
    };
  }

  private parse(config: string): ConfigAST {
    const lines = config.split("\n");
    const interfaceLines: string[] = [];
    const peers: PeerSection[] = [];

    const parseRecursive = (index: number): void => {
      if (index >= lines.length) {
        return;
      }

      const line = lines[index];
      const trimmed = line.trim();

      if (trimmed === "[Peer]") {
        const { peer, nextIndex } = this.parsePeerSection(lines, index);
        peers.push(peer);
        return parseRecursive(nextIndex);
      }

      // All other lines go to interface section
      interfaceLines.push(line);
      return parseRecursive(index + 1);
    };

    parseRecursive(0);

    return { interfaceLines, peers };
  }

  private compile(ast: ConfigAST): string {
    // Remove trailing blank lines from interface section
    const interfaceLines = [...ast.interfaceLines];
    while (interfaceLines.length > 0 && interfaceLines[interfaceLines.length - 1].trim() === "") {
      interfaceLines.pop();
    }

    const lines: string[] = [...interfaceLines];

    for (let i = 0; i < ast.peers.length; i++) {
      const peer = ast.peers[i];
      // Add blank line before peer (except before first peer if interface ends with newline)
      if (i > 0 || (lines.length > 0 && lines[lines.length - 1].trim() !== "")) {
        lines.push("");
      }
      lines.push("[Peer]");
      if (peer.comment) {
        lines.push(`# ${peer.comment}`);
      }
      lines.push(`PublicKey = ${peer.publicKey}`);
      if (peer.presharedKey) {
        lines.push(`PresharedKey = ${peer.presharedKey}`);
      }
      lines.push(`AllowedIPs = ${peer.allowedIPs}`);
      if (peer.endpoint) {
        lines.push(`Endpoint = ${peer.endpoint}`);
      }
      if (peer.persistentKeepalive) {
        lines.push(`PersistentKeepalive = ${peer.persistentKeepalive}`);
      }
    }

    return lines.join("\n");
  }

  compilePeerConfig(cmd: AddPeer, existingConfig: string): string {
    const ast = this.parse(existingConfig);

    // Transform: Add new peer
    const newPeer: PeerSection = {
      publicKey: cmd.publicKey,
      presharedKey: cmd.presharedKey,
      allowedIPs: cmd.allowedIPs,
      endpoint: cmd.endpoint,
      persistentKeepalive: cmd.persistentKeepalive,
    };
    ast.peers.push(newPeer);

    return this.compile(ast);
  }

  compileRemovePeerConfig(cmd: RemovePeer, existingConfig: string): string {
    const ast = this.parse(existingConfig);

    // Transform: Remove peer by publicKey
    ast.peers = ast.peers.filter((peer) => peer.publicKey !== cmd.publicKey);

    return this.compile(ast);
  }
}
