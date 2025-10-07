import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import fs from "fs";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { name } = req.query;
  if (!name || typeof name !== "string") return res.status(400).json({ error: "Missing name" });

  const filePath = path.join(process.cwd(), "mock-data", `${name}.json`);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });

  const data = fs.readFileSync(filePath, "utf-8");
  res.status(200).json(JSON.parse(data));
}