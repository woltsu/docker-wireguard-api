import { Request, Response, Router } from "express";
import { wireGuard } from "../lib/wg/WireGuard";
import { authMiddleware } from "./middleware/authMiddleware";
import { errorMiddleware } from "./middleware/errorMiddleware";

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
    publicKey,
  });
});

router.use(errorMiddleware);

export default router;
