import { AddPeer } from "./cmd/AddPeer";
import { RemovePeer } from "./cmd/RemovePeer";

type CMD_TOKEN =
  | { readonly name: "wg" }
  | { readonly name: "show" }
  | { readonly name: "genkey" }
  | { readonly name: "genpsk" }
  | { readonly name: "pubkey"; readonly privateKey?: string }
  | { readonly name: "set"; readonly interface: string }
  | { readonly name: "peer"; readonly publicKey: string }
  | { readonly name: "preshared-key"; readonly pathToPresharedKey: string }
  | { readonly name: "allowed-ips"; readonly allowedIPs: string }
  | { readonly name: "remove" };

export class WireGuardCommandBuilder {
  show() {
    return this.compile([{ name: "wg" }, { name: "show" }]);
  }

  addPeer(cmd: AddPeer) {
    if (cmd.presharedKeyFile) {
      return this.compile([
        { name: "wg" },
        { name: "set", interface: "wg0" },
        { name: "peer", publicKey: cmd.publicKey },
        { name: "preshared-key", pathToPresharedKey: cmd.presharedKeyFile },
      ]);
    }

    return this.compile([
      { name: "wg" },
      { name: "set", interface: "wg0" },
      { name: "peer", publicKey: cmd.publicKey },
      { name: "allowed-ips", allowedIPs: cmd.allowedIPs },
    ]);
  }

  removePeer(cmd: RemovePeer) {
    return this.compile([
      { name: "wg" },
      { name: "set", interface: "wg0" },
      { name: "peer", publicKey: cmd.publicKey },
      { name: "remove" },
    ]);
  }

  genkey() {
    return this.compile([{ name: "wg" }, { name: "genkey" }]);
  }

  genpsk() {
    return this.compile([{ name: "wg" }, { name: "genpsk" }]);
  }

  pubkey(privateKey: string) {
    return `echo "${privateKey}" | ${this.compile([
      { name: "wg" },
      { name: "pubkey" },
    ])}`;
  }

  private compile(cmd: CMD_TOKEN[]): string {
    return cmd.map((c) => this.parseToken(c)).join(" ");
  }

  private parseToken(token: CMD_TOKEN): string {
    switch (token.name) {
      case "wg":
        return "wg";
      case "show":
        return "show";
      case "genkey":
        return "genkey";
      case "genpsk":
        return "genpsk";
      case "pubkey":
        if (token.privateKey) {
          return `pubkey ${token.privateKey}`;
        }

        return "pubkey";
      case "set":
        return `set ${token.interface}`;
      case "peer":
        return `peer "${token.publicKey}"`;
      case "preshared-key":
        return `preshared-key ${token.pathToPresharedKey}`;
      case "allowed-ips":
        return `allowed-ips ${token.allowedIPs}`;
      case "remove":
        return `remove`;
      default:
        const _exhaustive: never = token;
        throw new Error(`Unknown token: ${_exhaustive}`);
    }
  }
}
