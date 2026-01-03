import { readFile, writeFile, unlink } from "fs/promises";
import { execAsync } from "../../util/exec";
import { generateNextAllowedIP } from "../../util/ip";
import { tmpdir } from "os";
import { join } from "path";
import { AddPeer } from "./cmd/AddPeer";
import { WireGuardCommandBuilder } from "./WireGuardCommandBuilder";
import { WireGuardConfigBuilder } from "./WireGuardConfigBuilder";
import { RemovePeer } from "./cmd/RemovePeer";

type WireGuardOpts = {
  configPath: string;
  interface: string;
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

  async generateNextAllowedIP(): Promise<string> {
    const config = await this.readConfig();
    return generateNextAllowedIP(this.internalSubnet, config);
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
        interface: this.opts.interface,
        allowedIPs: allowedIps,
        publicKey: peerPublicKey,
        presharedKey,
        presharedKeyFile: tempPskFile.path,
      };

      const addPeerCmd = this.commandBuilder.addPeer(cmd);
      const existingConfig = await this.readConfig();
      const newConfig = this.configBuilder.compilePeerConfig(
        cmd,
        existingConfig
      );

      await this.exec(addPeerCmd);
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

  async removePeer(publicKey: string) {
    const cmd: RemovePeer = {
      name: "remove-peer",
      interface: this.opts.interface,
      publicKey,
    };
    const removePeerCmd = this.commandBuilder.removePeer(cmd);
    const existingConfig = await this.readConfig();
    const newConfig = this.configBuilder.compileRemovePeerConfig(
      cmd,
      existingConfig
    );

    await this.exec(removePeerCmd);
    await this.writeConfig(newConfig);
  }

  private async exec(cmd: string) {
    const { stdout, stderr } = await execAsync(cmd);
    if (stderr) {
      throw new Error(stderr);
    }
    return stdout.trim();
  }
}
