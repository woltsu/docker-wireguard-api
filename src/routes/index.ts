import { Router, Request, Response } from "express";
import { WireGuard } from "../lib/wg/WireGuard";
import { ConfigManager } from "../lib/wg/ConfigManager";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  res.send("Hello World!");
});

router.get("/wg", async (req: Request, res: Response) => {
  try {
    const { stdout, stderr } = await WireGuard.show();
    res.setHeader("Content-Type", "text/plain");
    res.send(stdout || stderr);
  } catch (error: any) {
    res.status(500).send(`Error executing wg command: ${error.message}`);
  }
});

router.get("/wg/client", async (req: Request, res: Response) => {
  try {
    const client = await WireGuard.generateClient();
    res.json(client);
  } catch (error: any) {
    res
      .status(500)
      .json({ error: `Error generating client: ${error.message}` });
  }
});

router.get("/wg/client/create", async (req: Request, res: Response) => {
  try {
    // Generate new client keys
    const client = await WireGuard.generateClient();

    // Get allowedIPs from request or generate one
    const allowedIPs = await generateNextAllowedIP();

    // Add peer to config
    const peerConfig = {
      publicKey: client.publicKey,
      presharedKey: client.presharedKey,
      allowedIPs,
    };

    await ConfigManager.addPeer(peerConfig);

    res.json({
      message: "Client created and added to WireGuard config",
      client: {
        privateKey: client.privateKey,
        publicKey: client.publicKey,
        presharedKey: client.presharedKey,
      },
      peer: {
        allowedIPs,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: `Error creating client: ${error.message}` });
  }
});

router.post("/wg/client/add", async (req: Request, res: Response) => {
  try {
    const { publicKey, presharedKey, allowedIPs } = req.body;

    if (!publicKey || !allowedIPs) {
      return res.status(400).json({
        error: "Missing required fields: publicKey and allowedIPs are required",
      });
    }

    // Get the next available IP from the subnet
    // For now, we'll use the provided allowedIPs or generate one
    const peerConfig = {
      publicKey,
      presharedKey,
      allowedIPs: allowedIPs || (await generateNextAllowedIP()),
    };

    await ConfigManager.addPeer(peerConfig);

    res.json({
      message: "Peer added successfully",
      peer: peerConfig,
    });
  } catch (error: any) {
    res.status(500).json({ error: `Error adding peer: ${error.message}` });
  }
});

router.get("/wg/client/remove", async (req: Request, res: Response) => {
  try {
    const publicKey = req.query.publicKey as string;

    if (!publicKey) {
      return res.status(400).json({
        error: "Missing required query parameter: publicKey",
      });
    }

    await ConfigManager.removePeer(publicKey);

    res.json({
      message: "Peer removed successfully",
      publicKey,
    });
  } catch (error: any) {
    res.status(500).json({ error: `Error removing peer: ${error.message}` });
  }
});

// Helper function to generate next allowed IP
async function generateNextAllowedIP(): Promise<string> {
  // This is a simplified version - you might want to track used IPs
  // For now, return a default subnet IP
  const subnet = process.env.INTERNAL_SUBNET || "10.13.13.0/24";
  const baseIP = subnet.split("/")[0].split(".");
  // Simple increment - in production, you'd want to track used IPs
  const lastOctet = Math.floor(Math.random() * 254) + 2; // 2-255
  return `${baseIP[0]}.${baseIP[1]}.${baseIP[2]}.${lastOctet}/32`;
}

export default router;
