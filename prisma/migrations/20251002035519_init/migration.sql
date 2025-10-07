/*
  Warnings:

  - A unique constraint covering the columns `[endpoint,method]` on the table `Mapping` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Mapping_endpoint_method_key" ON "Mapping"("endpoint", "method");
