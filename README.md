# Automatización de cobranzas con Evolution API

Este repositorio inicia una guía práctica para construir una aplicación de **cobranzas automatizadas** conectada con Evolution API (WhatsApp).

## 1) Objetivo del MVP

Crear un sistema que:
- lea facturas pendientes desde tu sistema administrativo/ERP,
- envíe recordatorios de pago por WhatsApp,
- registre respuestas del cliente,
- actualice el estado de cobranza,
- escale casos sin respuesta a una gestión manual.

## 2) Arquitectura recomendada (fase inicial)

- **Backend API** (Node.js/NestJS, Python/FastAPI o similar)
  - Lógica de negocio de cobranzas.
  - Integración con Evolution API para envío/recepción de mensajes.
- **Base de datos** (PostgreSQL recomendado)
  - Clientes, facturas, campañas, mensajes, estados y auditoría.
- **Worker de colas** (BullMQ/Celery/SQS)
  - Programación y envío de mensajes por lotes.
- **Dashboard web**
  - Monitoreo de campañas, métricas y gestión manual.

## 3) Flujo de negocio sugerido

1. Importar facturas vencidas o próximas a vencer.
2. Segmentar por reglas:
   - 7 días antes,
   - día de vencimiento,
   - 3 días después.
3. Generar mensaje personalizado (nombre, monto, fecha, link de pago).
4. Enviar por Evolution API.
5. Recibir webhook de respuestas del cliente.
6. Clasificar intención:
   - "ya pagué",
   - "promesa de pago",
   - "necesito ayuda",
   - "no responde".
7. Actualizar estado y disparar siguiente acción automática.

## 4) Datos mínimos que debes definir desde el día 1

- **Cliente**: id, nombre, teléfono WhatsApp, zona horaria, consentimiento.
- **Factura**: id, cliente_id, monto, moneda, vencimiento, estado.
- **Mensaje**: factura_id, template, canal, enviado_en, entregado, leído, respondido.
- **Gestión**: estado_cobranza, próxima_acción, responsable, notas.

## 5) Integración con Evolution API (checklist)

- Crear y validar instancia de WhatsApp en Evolution API.
- Configurar token/API key en variables de entorno.
- Implementar endpoint para `sendMessage`.
- Configurar endpoint de webhook para mensajes entrantes y estados.
- Validar firma/autenticación del webhook.
- Implementar reintentos y control de errores (429/5xx).

## 6) Seguridad y cumplimiento

- Cifrar credenciales y secretos (`.env` + secret manager).
- Registro de auditoría por cada contacto.
- Políticas de opt-out (si cliente pide no recibir mensajes).
- Horarios permitidos de contacto por país/región.

## 7) Métricas clave

- Tasa de entrega.
- Tasa de respuesta.
- Tasa de promesa de pago.
- Recuperación ($) por campaña.
- Días de mora promedio antes/después de automatizar.

## 8) Plan de implementación en 2 semanas

### Semana 1
- Modelado de datos y backend base.
- Integración de envío de mensajes con Evolution API.
- Primer webhook de recepción.
- Plantillas de recordatorio (3 variantes).

### Semana 2
- Motor de reglas de cobranza.
- Dashboard mínimo (lista de casos + estado).
- Métricas principales.
- Pruebas piloto con un subconjunto de clientes.

## 9) Próximo paso recomendado

Antes de escribir código, define estos 5 puntos:
1. De dónde salen tus facturas (ERP, Excel, API).
2. Cómo es el ciclo de cobranza actual (días y acciones).
3. Qué métodos de pago vas a incluir (link, transferencia, botón).
4. Qué mensajes aprobará legal/compliance.
5. Cuál será el KPI principal del piloto (ej: +20% recuperación en 30 días).

Con eso, ya puedes pasar a diseñar el primer endpoint y el primer flujo automatizado.
