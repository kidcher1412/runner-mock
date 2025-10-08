import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "DELETE") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { name } = req.query;
  if (!name || typeof name !== "string") {
    return res.status(400).json({ error: "Project name is required" });
  }

  try {
    const project = await prisma.project.findUnique({ where: { name } });
    if (!project) return res.status(404).json({ error: "Project not found" });

    // Xóa file JSON
    if (project.file && fs.existsSync(project.file)) fs.unlinkSync(project.file);

    // Xóa DB SQLite nếu có
    if (project.dbFile && fs.existsSync(project.dbFile)) fs.unlinkSync(project.dbFile);

    // Xóa record DB
    await prisma.project.delete({ where: { name } });

    res.status(200).json({ message: `Deleted project ${name}` });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
