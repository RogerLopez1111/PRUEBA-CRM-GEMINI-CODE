-- add-comentario-comprador-faltantes.sql
-- Adds a dedicated buyer comment to each producto faltante. The seller's reason
-- stays in `comentario`; this new column holds the comment the Compras
-- (comprador) role writes back when they review the stock-out — e.g. "pedido al
-- proveedor, llega la próxima semana" or "descontinuado, se sugiere sustituto".
--
-- Run once in the Supabase SQL editor.

alter table productos_faltantes
  add column if not exists comentario_comprador text;
