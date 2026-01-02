import express from "express";
import router from "./routes";

const app = express();
const PORT = parseInt(process.env.WG_API_PORT || "3000", 10);

app.use(express.json());
app.use("/", router);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
