import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@/generated/prisma";
import { resolveToAbsolute } from "@/lib/utils";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "PUT") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { name, newName, useDB } = req.body;

    if (!name) return res.status(400).json({ error: "Missing project name" });

    const project = await prisma.project.findUnique({ where: { name } });
    if (!project) return res.status(404).json({ error: "Project not found" });

    let newFilePath = project.file;
    let newDbFile = project.dbFile || null;

    // Nếu đổi tên
    if (newName && newName !== name) {
      const mockDir = path.join(process.cwd(), "mock-data");
      const absOldJson = resolveToAbsolute(project.file);
      const absOldDb = project.dbFile ? resolveToAbsolute(project.dbFile) : null;
      const absNewJson = path.join(mockDir, `${newName}.json`);
      const absNewDb = project.useDB ? path.join(mockDir, `${newName}.sqlite`) : null;

      if (fs.existsSync(absOldJson)) fs.renameSync(absOldJson, absNewJson);
      if (absOldDb && absNewDb && fs.existsSync(absOldDb)) fs.renameSync(absOldDb, absNewDb);

      newFilePath = `./mock-data/${newName}.json`;
      newDbFile = project.useDB ? `./mock-data/${newName}.sqlite` : null;
    }

    const updated = await prisma.project.update({
      where: { name },
      data: {
        name: newName || name,
        useDB: useDB !== undefined ? useDB : project.useDB,
        file: newFilePath,
        dbFile: newDbFile || undefined,
      },
    });

    res.status(200).json({ message: "Project updated", project: updated });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
