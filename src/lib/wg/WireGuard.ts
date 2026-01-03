import { readFile, writeFile, unlink } from "fs/promises";
import { execAsync } from "../../util/exec";
import { tmpdir } from "os";
import { join } from "path";
import { AddPeer } from "./cmd/AddPeer";
import { WireGuardCommandBuilder } from "./WireGuardCommandBuilder";
import { WireGuardConfigBuilder } from "./WireGuardConfigBuilder";

type WireGuardOpts = {
  configPath: string;
  internalSubnet?: string;
};

export class WireGuard {
  private readonly commandBuilder: WireGuardCommandBuilder;
  private readonly configBuilder: WireGuardConfigBuilder;
  private readonly opts: WireGuardOpts;
  private readonly internalSubnet: string;

  constructor(opts: WireGuardOpts) {
    if (!opts.internalSubnet) {
      throw new Error("internalSubnet is required");
    }

    this.commandBuilder = new WireGuardCommandBuilder();
    this.configBuilder = new WireGuardConfigBuilder();
    this.opts = opts;
    this.internalSubnet = opts.internalSubnet;
  }

  async show() {
    const showCmd = this.commandBuilder.show();
    return this.exec(showCmd);
  }

  private async readConfig() {
    return (await readFile(this.opts.configPath, "utf-8")).trim();
  }

  private async writeConfig(config: string) {
    return await writeFile(this.opts.configPath, config, "utf-8");
  }

  private createTempPskFile(): { path: string; cleanup: () => Promise<void> } {
    const path = join(
      tmpdir(),
      `wg-psk-${Date.now()}-${Math.random().toString(36).substring(7)}`
    );
    return {
      path,
      cleanup: async () => {
        try {
          await unlink(path);
        } catch {
          console.error(`Failed to cleanup temp psk file: ${path}`);
        }
      },
    };
  }

  private ipToInt(ip: string): number {
    const parts = ip.split(".").map(Number);
    return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  }

  private intToIp(int: number): string {
    return [
      (int >>> 24) & 255,
      (int >>> 16) & 255,
      (int >>> 8) & 255,
      int & 255,
    ].join(".");
  }

  async generateNextAllowedIP(): Promise<string> {
    const [subnetIP, cidr] = this.internalSubnet.split("/");
    const mask = parseInt(cidr, 10);

    const networkInt = this.ipToInt(subnetIP);
    const startIP = networkInt + 1;
    const endIP = networkInt + Math.pow(2, 32 - mask) - 2;

    const config = await this.readConfig();
    const usedIPs = new Set<number>();

    const ipPattern = /(\d+\.\d+\.\d+\.\d+)/g;
    let match;
    while ((match = ipPattern.exec(config)) !== null) {
      const ipInt = this.ipToInt(match[1]);
      if (ipInt >= startIP && ipInt <= endIP) {
        usedIPs.add(ipInt);
      }
    }

    for (let ip = startIP; ip <= endIP; ip++) {
      if (!usedIPs.has(ip)) {
        return `${this.intToIp(ip)}/32`;
      }
    }

    throw new Error(`No available IPs in subnet ${this.internalSubnet}`);
  }

  async addPeer() {
    const allowedIps = await this.generateNextAllowedIP();

    const peerPrivateKeyCmd = this.commandBuilder.genkey();
    const peerPrivateKey = await this.exec(peerPrivateKeyCmd);

    const peerPublicKeyCmd = this.commandBuilder.pubkey(peerPrivateKey);
    const peerPublicKey = await this.exec(peerPublicKeyCmd);

    const presharedKeyCmd = this.commandBuilder.genpsk();
    const presharedKey = await this.exec(presharedKeyCmd);

    const tempPskFile = this.createTempPskFile();

    try {
      await writeFile(tempPskFile.path, presharedKey, "utf-8");

      const cmd: AddPeer = {
        name: "add-peer",
        allowedIPs: allowedIps,
        publicKey: peerPublicKey,
        presharedKey,
        presharedKeyFile: tempPskFile.path,
      };

      const addPeerCmd = this.commandBuilder.addPeer(cmd);
      await this.exec(addPeerCmd);
      const peerConfig = this.configBuilder.compilePeerConfig(cmd);
      const existingConfig = (await this.readConfig()).trimEnd();
      const newConfig = existingConfig + "\n\n" + peerConfig;
      await this.writeConfig(newConfig);

      return {
        privateKey: peerPrivateKey,
        publicKey: peerPublicKey,
        presharedKey,
        allowedIPs: allowedIps,
      };
    } catch (error: unknown) {
      throw new Error(
        `Failed to add peer: ${
          error instanceof Error ? error.message : "unknown error"
        }`
      );
    } finally {
      await tempPskFile.cleanup();
    }
  }

  private async exec(cmd: string) {
    const { stdout, stderr } = await execAsync(cmd);
    if (stderr) {
      throw new Error(stderr);
    }
    return stdout.trim();
  }
}
