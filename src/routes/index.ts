import { Request, Response, Router } from "express";
import { WireGuard } from "../lib/wg/WireGuard";
import { authMiddleware } from "./middleware/authMiddleware";
import { errorMiddleware } from "./middleware/errorMiddleware";

// TODO: Take config path and interface as environment variables?
// TODO: Export a singleton instance of WireGuard?
const wireGuard = new WireGuard({
  configPath: "/config/wg_confs/wg0.conf",
  interface: "wg0",
  internalSubnet: process.env.INTERNAL_SUBNET,
});

const router = Router();

router.use(authMiddleware);

router.get("/wg", async (req: Request, res: Response) => {
  res.json({
    result: await wireGuard.show(),
  });
});

router.post("/wg/client", async (req: Request, res: Response) => {
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

router.delete("/wg/client", async (req: Request, res: Response) => {
  const publicKey = req.body.publicKey as string;
  await wireGuard.removePeer(publicKey);

  res.json({
    message: "Client removed from WireGuard config",
    publicKey,
  });
});

router.use(errorMiddleware);

export default router;
