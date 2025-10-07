import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@/generated/prisma";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { projectId, endpoint, method, sql, jsonPath } = req.body;

  try {
    const mapping = await prisma.mapping.upsert({
      where: { endpoint_method: { endpoint, method } },
      update: { sql, jsonPath },
      create: { projectId, endpoint, method, sql, jsonPath },
    });
    res.status(200).json({ message: "Mapping saved", mapping });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
