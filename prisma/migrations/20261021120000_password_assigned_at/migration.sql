-- El aviso de "cambia la contraseña que te asignamos" pasa de booleano a fecha: la
-- persona cambia su clave en Clerk y el webhook user.updated apaga el aviso cuando
-- password_last_updated_at es posterior a la asignación del admin.
ALTER TABLE "User" ADD COLUMN "passwordAssignedAt" TIMESTAMP(3);
UPDATE "User" SET "passwordAssignedAt" = "updatedAt" WHERE "mustChangePassword";
ALTER TABLE "User" DROP COLUMN "mustChangePassword";
