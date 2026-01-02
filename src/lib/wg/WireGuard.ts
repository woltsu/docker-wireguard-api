import { execAsync } from "../../util/exec";

export class WireGuard {
  static async show() {
    return execAsync("wg show");
  }

  static async genkey(): Promise<string> {
    const { stdout } = await execAsync("wg genkey");
    return stdout.trim();
  }

  static async genpsk(): Promise<string> {
    const { stdout } = await execAsync("wg genpsk");
    return stdout.trim();
  }

  static async pubkey(privateKey: string): Promise<string> {
    const { stdout } = await execAsync(`echo "${privateKey}" | wg pubkey`);
    return stdout.trim();
  }

  static async generateClient() {
    const privateKey = await this.genkey();
    const publicKey = await this.pubkey(privateKey);
    const presharedKey = await this.genpsk();

    return {
      privateKey,
      publicKey,
      presharedKey,
    };
  }
}
