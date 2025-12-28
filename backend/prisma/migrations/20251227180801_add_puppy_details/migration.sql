/*
  Warnings:

  - Added the required column `age` to the `Puppy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `breed` to the `Puppy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `energyLevel` to the `Puppy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `gender` to the `Puppy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `goodWithKids` to the `Puppy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `goodWithPets` to the `Puppy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `price` to the `Puppy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `temperament` to the `Puppy` table without a default value. This is not possible if the table is not empty.
  - Added the required column `weight` to the `Puppy` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Puppy" ADD COLUMN     "age" INTEGER NOT NULL,
ADD COLUMN     "available" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "breed" TEXT NOT NULL,
ADD COLUMN     "energyLevel" TEXT NOT NULL,
ADD COLUMN     "gender" TEXT NOT NULL,
ADD COLUMN     "goodWithKids" BOOLEAN NOT NULL,
ADD COLUMN     "goodWithPets" BOOLEAN NOT NULL,
ADD COLUMN     "price" INTEGER NOT NULL,
ADD COLUMN     "requirements" TEXT,
ADD COLUMN     "temperament" TEXT NOT NULL,
ADD COLUMN     "weight" DOUBLE PRECISION NOT NULL;
