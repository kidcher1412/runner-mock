-- CreateTable
CREATE TABLE "Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "file" TEXT NOT NULL,
    "useDB" BOOLEAN NOT NULL DEFAULT false,
    "dbFile" TEXT
);

-- CreateTable
CREATE TABLE "Mapping" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "endpoint" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "sql" TEXT NOT NULL,
    "jsonPath" TEXT NOT NULL,
    "projectId" INTEGER NOT NULL,
    CONSTRAINT "Mapping_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Project_name_key" ON "Project"("name");
