import { Request, Response, Router } from "express";
import { WireGuard } from "../lib/wg/WireGuard";
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
