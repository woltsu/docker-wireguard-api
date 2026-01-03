import { readFile, writeFile, unlink } from "fs/promises";
import { execAsync } from "../../util/exec";
import { tmpdir } from "os";
import { join } from "path";

const CONFIG_PATH = "/config/wg_confs/wg0.conf";

export interface PeerConfig {
  publicKey: string;
  presharedKey?: string;
  allowedIPs: string;
  endpoint?: string;
  persistentKeepalive?: number;
}

export class ConfigManager {
  static async readConfig(): Promise<string> {
    try {
      return await readFile(CONFIG_PATH, "utf-8");
    } catch (error: any) {
      throw new Error(`Failed to read config: ${error.message}`);
    }
  }

  static async writeConfig(config: string): Promise<void> {
    try {
      await writeFile(CONFIG_PATH, config, "utf-8");
    } catch (error: any) {
      throw new Error(`Failed to write config: ${error.message}`);
    }
  }

  static addPeerToConfig(config: string, peer: PeerConfig): string {
    // Ensure config ends with a newline
    const trimmedConfig = config.trimEnd();
    
    const peerSection = [
      "[Peer]",
      `PublicKey = ${peer.publicKey}`,
      ...(peer.presharedKey ? [`PresharedKey = ${peer.presharedKey}`] : []),
      `AllowedIPs = ${peer.allowedIPs}`,
      ...(peer.endpoint ? [`Endpoint = ${peer.endpoint}`] : []),
      ...(peer.persistentKeepalive
        ? [`PersistentKeepalive = ${peer.persistentKeepalive}`]
        : []),
    ].join("\n");

    // Add newline before peer section if config doesn't end with one
    return trimmedConfig + "\n\n" + peerSection + "\n";
  }

  static async reloadConfig(): Promise<void> {
    try {
      // Use wg syncconf to reload without dropping connections
      await execAsync("wg syncconf wg0 /config/wg_confs/wg0.conf");
    } catch (error: any) {
      throw new Error(`Failed to reload config: ${error.message}`);
    }
  }

  static async addPeer(peer: PeerConfig): Promise<void> {
    // First, add peer to running WireGuard using wg set
    let tempPskFile: string | null = null;
    
    try {
      // If preshared key exists, create a temporary file
      if (peer.presharedKey) {
        tempPskFile = join(tmpdir(), `wg-psk-${Date.now()}-${Math.random().toString(36).substring(7)}`);
        await writeFile(tempPskFile, peer.presharedKey, "utf-8");
        // Quote public key to handle special characters like /, +, =
        await execAsync(`wg set wg0 peer '${peer.publicKey}' preshared-key ${tempPskFile}`);
      }
      
      // Set allowed IPs (this also creates the peer if it doesn't exist)
      // Quote public key to handle special characters like /, +, =
      await execAsync(`wg set wg0 peer '${peer.publicKey}' allowed-ips ${peer.allowedIPs}`);
    } catch (error: any) {
      // Clean up temp file if it exists
      if (tempPskFile) {
        try {
          await unlink(tempPskFile);
        } catch {
          // Ignore cleanup errors
        }
      }
      throw new Error(`Failed to add peer to WireGuard: ${error.message}`);
    } finally {
      // Clean up temp file
      if (tempPskFile) {
        try {
          await unlink(tempPskFile);
        } catch {
          // Ignore cleanup errors
        }
      }
    }

    // Then update the config file to persist the change
    const config = await this.readConfig();
    const updatedConfig = this.addPeerToConfig(config, peer);
    await this.writeConfig(updatedConfig);
  }

  static removePeerFromConfig(config: string, publicKey: string): string {
    const lines = config.split("\n");
    const newLines: string[] = [];
    let currentPeerLines: string[] = [];
    let inPeerSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Check if we're entering a [Peer] section
      if (trimmedLine === "[Peer]") {
        // If we were in a previous peer section, check if we should keep it
        if (inPeerSection && currentPeerLines.length > 0) {
          const peerSection = currentPeerLines.join("\n");
          if (!peerSection.includes(`PublicKey = ${publicKey}`)) {
            // Keep this peer section
            newLines.push(...currentPeerLines);
          }
        }
        // Start a new peer section
        currentPeerLines = [line];
        inPeerSection = true;
        continue;
      }

      // Check if we're leaving peer sections (entering Interface or other section)
      if (trimmedLine.startsWith("[") && trimmedLine !== "[Peer]") {
        // Process the current peer section if we were in one
        if (inPeerSection && currentPeerLines.length > 0) {
          const peerSection = currentPeerLines.join("\n");
          if (!peerSection.includes(`PublicKey = ${publicKey}`)) {
            newLines.push(...currentPeerLines);
          }
          currentPeerLines = [];
          inPeerSection = false;
        }
        // Add the new section header
        newLines.push(line);
        continue;
      }

      // Add line to current peer section or to output
      if (inPeerSection) {
        currentPeerLines.push(line);
      } else {
        newLines.push(line);
      }
    }

    // Handle the last peer section if we ended in one
    if (inPeerSection && currentPeerLines.length > 0) {
      const peerSection = currentPeerLines.join("\n");
      if (!peerSection.includes(`PublicKey = ${publicKey}`)) {
        newLines.push(...currentPeerLines);
      }
    }

    return newLines.join("\n");
  }

  static async removePeer(publicKey: string): Promise<void> {
    // First, remove peer from running WireGuard
    try {
      // Use single quotes to safely handle special characters in the public key (/, +, =)
      await execAsync(`wg set wg0 peer '${publicKey}' remove`);
    } catch (error: any) {
      throw new Error(`Failed to remove peer from WireGuard: ${error.message}`);
    }

    // Then update the config file to persist the change
    const config = await this.readConfig();
    const updatedConfig = this.removePeerFromConfig(config, publicKey);
    await this.writeConfig(updatedConfig);
  }
}

