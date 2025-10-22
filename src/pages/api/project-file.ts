import type { NextApiRequest, NextApiResponse } from "next";
import path from "path";
import fs from "fs";
import { PrismaClient } from "@/generated/prisma";
import { resolveToAbsolute } from "@/lib/utils";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { name } = req.query;
  if (!name || typeof name !== "string") return res.status(400).json({ error: "Missing name" });

  try {
    const project = await prisma.project.findUnique({ where: { name } });
    const fallback = path.join(process.cwd(), "mock-data", `${name}.json`);
    const abs = resolveToAbsolute(project?.file || `./mock-data/${name}.json`);
    const filePath = abs || fallback;
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: "File not found" });
    const data = fs.readFileSync(filePath, "utf-8");
    res.status(200).json(JSON.parse(data));
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
}