-- Identidad en Clerk, autorización en esta base.
--  * clerkUserId: enlace con el usuario de Clerk (contraseña, Google, Apple, sesiones).
--  * passwordHash pasa a opcional: Clerk guarda las claves. El hash legado solo sirve
--    para importar a los usuarios existentes y se elimina en una migración posterior.
--  * mustChangePassword: el admin asigna la clave inicial y se sugiere cambiarla.
--  * El correo se guarda sin espacios y en minúsculas, y la base lo exige.

-- Normalización previa al CHECK (en producción, oct 2026: 0 filas por normalizar
-- y sin colisiones; si las hubiera, el UNIQUE de email aborta la migración).
UPDATE "User" SET "email" = lower(btrim("email")) WHERE "email" <> lower(btrim("email"));
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized" CHECK ("email" = lower(btrim("email")));

ALTER TABLE "User" ADD COLUMN "clerkUserId" TEXT;
CREATE UNIQUE INDEX "User_clerkUserId_key" ON "User"("clerkUserId");

ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

ALTER TABLE "User" ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false;
