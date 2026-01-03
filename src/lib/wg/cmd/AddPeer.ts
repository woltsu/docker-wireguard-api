export type AddPeer = {
  readonly name: "add-peer";
  readonly publicKey: string;
  readonly interface: string;
  readonly presharedKey?: string;
  readonly presharedKeyFile?: string;
  readonly allowedIPs: string;
  readonly endpoint?: string;
  readonly persistentKeepalive?: number;
};
