import fs from "fs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "mock-data/db.json");

export interface Project {
  name: string;
  file: string; // đường dẫn file OpenAPI
}

function readDB(): Project[] {
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify([]));
    return [];
  }
  const data = fs.readFileSync(DB_PATH, "utf-8");
  return JSON.parse(data);
}

function writeDB(projects: Project[]) {
  fs.writeFileSync(DB_PATH, JSON.stringify(projects, null, 2));
}

export function getProjects(): Project[] {
  return readDB();
}

export function addProject(project: Project) {
  const projects = readDB();
  const existing = projects.find(p => p.name === project.name);
  if (existing) throw new Error("Project already exists");
  projects.push(project);
  writeDB(projects);
}
