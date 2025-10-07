import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  try {
    const projects = await prisma.project.findMany();
    res.status(200).json(projects);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}
