export function ipToInt(ip: string): number {
  const parts = ip.split(".").map(Number);
  return (parts[0] << 24) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
}

export function intToIp(int: number): string {
  return [
    (int >>> 24) & 255,
    (int >>> 16) & 255,
    (int >>> 8) & 255,
    int & 255,
  ].join(".");
}

export function generateNextAllowedIP(
  internalSubnet: string,
  config: string
): string {
  const [subnetIP, cidr] = internalSubnet.split("/");
  const mask = parseInt(cidr, 10);

  const networkInt = ipToInt(subnetIP);
  const startIP = networkInt + 1;
  const endIP = networkInt + Math.pow(2, 32 - mask) - 2;

  const usedIPs = new Set<number>();

  const ipPattern = /(\d+\.\d+\.\d+\.\d+)/g;
  let match;
  while ((match = ipPattern.exec(config)) !== null) {
    const ipInt = ipToInt(match[1]);
    if (ipInt >= startIP && ipInt <= endIP) {
      usedIPs.add(ipInt);
    }
  }

  for (let ip = startIP; ip <= endIP; ip++) {
    if (!usedIPs.has(ip)) {
      return `${intToIp(ip)}/32`;
    }
  }

  throw new Error(`No available IPs in subnet ${internalSubnet}`);
}

