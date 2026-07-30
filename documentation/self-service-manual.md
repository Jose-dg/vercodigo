# Manual de Uso: Activación Autoservicio y Códigos Instantáneos

Este documento explica cómo utilizar las nuevas funcionalidades implementadas en el sistema Diem SAS.

## 1. Activación de Tarjetas

El módulo de activación permite a los **Operadores de Tienda** activar tarjetas físicas mediante escaneo de QR o ingreso manual.

### 1.1 Acceso
*   Navegue a `/scan` o pulse el botón **"Escanear QR"** en la barra lateral.

### 1.2 Flujo de Activación
1.  **Escaneo**:
    *   Conceda permiso de cámara si se le solicita.
    *   Enfoque el código QR de la tarjeta.
    *   El sistema detectará automáticamente el código.
2.  **Ingreso Manual** (Alternativa):
    *   Si la cámara no funciona, escriba el Código UUID de la tarjeta en el campo de texto.
3.  **Confirmación**:
    *   Aparecerá una ventana modal con los detalles de la tarjeta (Producto, Tienda).
    *   Verifique que la información sea correcta.
    *   Escriba la palabra **"ACTIVAR"** (en mayúsculas) para confirmar.
    *   Pulse **"Confirmar Activación"**.
4.  **Resultado**:
    *   **Éxito**: Verá un mensaje verde con la fecha de activación.
    *   **Error**: Si la tarjeta ya está activa o hay un problema (saldo, permisos), verá un mensaje de error rojo.

### 1.3 Validaciones
El sistema verifica automáticamente:
*   Que usted pertenezca a la misma tienda que la tarjeta.
*   Que la tarjeta no haya sido activada previamente.
*   Que no se excedan los límites de velocidad (Rate Limits) para prevenir fraude.

---

## 2. Compra de Códigos Infantiles (Instant Codes)

Permite adquirir códigos digitales (PINs) de forma inmediata para entrega al cliente.

### 2.1 Acceso
*   Navegue a `/codes/purchase` o busque "Comprar Códigos" en el menú.

### 2.2 Flujo de Compra
1.  **Selección**:
    *   Elija el **Producto** deseado del menú desplegable.
    *   Indique la **Cantidad** de códigos a comprar (Máximo 100 por transacción).
2.  **Confirmación**:
    *   Revise el resumen.
    *   Pulse **"Confirmar Compra"**.
3.  **Entrega**:
    *   Al completarse, verá la lista de códigos adquiridos en pantalla.
    *   Use el botón **"Copiar Todos"** para pegarlos en un correo o mensaje.
    *   *Nota*: Estos códigos se marcan inmediatamente como `SOLD` (Vendidos) en el inventario.

---

## 3. Resolución de Problemas (Troubleshooting)

### 3.1 La activación falló pero no estoy seguro
El sistema cuenta con un registro de intentos (`ActivationJob`).
1.  Si recibe un error "Timeout" o "Procesando", espere unos minutos.
2.  No intente activar la misma tarjeta inmediatamente si sospecha que el sistema está lento; consulte el historial de la tarjeta.

### 3.2 Reintentos (Solo Administradores)
Si una activación falla por problemas técnicos (ej. caída de internet momentánea), el sistema guarda el estado `FAILED`.
*   Los administradores pueden disparar un **Reintento Manual** desde la API o panel de administración (Endpoint: `POST /api/jobs/retry`).
*   Esto intentará procesar nuevamente las activaciones fallidas sin cobrar doble.

### 3.3 Errores Comunes
*   **403 Forbidden**: Su usuario no tiene permisos para esta tienda.
*   **409 Conflict**: La tarjeta ya fue activada.
*   **429 Too Many Requests**: Ha intentado activar demasiadas tarjetas en poco tiempo. Espere 1 minuto.
