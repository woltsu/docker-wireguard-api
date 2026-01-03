import { Router, Request, Response } from "express";
import { WireGuard } from "../lib/wg/WireGuard";
import { ConfigManager } from "../lib/wg/WireGuardConfigManager";
import { errorMiddleware } from "./middleware/errorMiddleware";

const wireGuard = new WireGuard({
  configPath: "/config/wg_confs/wg0.conf",
  internalSubnet: process.env.INTERNAL_SUBNET,
});
const router = Router();

router.get("/wg", async (req: Request, res: Response) => {
  res.json({
    result: await wireGuard.show(),
  });
});

router.get("/wg/client/create", async (req: Request, res: Response) => {
  const result = await wireGuard.addPeer();

  res.json({
    message: "Client created and added to WireGuard config",
    client: {
      privateKey: result.privateKey,
      publicKey: result.publicKey,
      presharedKey: result.presharedKey,
    },
    peer: {
      allowedIPs: result.allowedIPs,
    },
  });
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
      allowedIPs: allowedIPs || wireGuard.generateNextAllowedIP(),
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

router.use(errorMiddleware);

export default router;
