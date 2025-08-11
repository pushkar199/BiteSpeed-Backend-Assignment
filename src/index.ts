import express from "express";
import bodyParser from "body-parser";
import { initDB } from "./db";
import { identifyHandler } from "./identify";

const app = express();
app.use(bodyParser.json());

(async () => {
  const db = await initDB();
  app.post("/identify", (req, res) => identifyHandler(db, req, res));

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  app.listen(port, () => console.log(`Server running on port ${port}`));
})().catch(err => {
  console.error("Failed to initialize DB", err);
  process.exit(1);
});
