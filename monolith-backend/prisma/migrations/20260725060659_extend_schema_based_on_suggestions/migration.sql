/*
  Warnings:

  - You are about to drop the column `name` on the `node_type_definitions` table. All the data in the column will be lost.
  - Added the required column `display_name` to the `node_type_definitions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "executions" ADD COLUMN     "context" JSONB;

-- AlterTable
ALTER TABLE "node_type_definitions" DROP COLUMN "name",
ADD COLUMN     "color" VARCHAR(50),
ADD COLUMN     "display_name" VARCHAR(255) NOT NULL,
ADD COLUMN     "icon" VARCHAR(255),
ADD COLUMN     "input_schema" JSONB,
ADD COLUMN     "output_schema" JSONB;
