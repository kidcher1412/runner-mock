import { NextApiRequest, NextApiResponse } from "next";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@/generated/prisma";

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
    let newDbFile = project.dbFile;

    // Nếu đổi tên
    if (newName && newName !== name) {
      const mockDir = path.join(process.cwd(), "mock-data");
      newFilePath = path.join(mockDir, `${newName}.json`);
      newDbFile = project.useDB ? path.join(mockDir, `${newName}.sqlite`) : null;

      if (fs.existsSync(project.file)) fs.renameSync(project.file, newFilePath);
      if (project.dbFile && fs.existsSync(project.dbFile)) fs.renameSync(project.dbFile, newDbFile!);
    }

    const updated = await prisma.project.update({
      where: { name },
      data: {
        name: newName || name,
        useDB: useDB !== undefined ? useDB : project.useDB,
        file: newFilePath,
        dbFile: newDbFile,
      },
    });

    res.status(200).json({ message: "Project updated", project: updated });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
