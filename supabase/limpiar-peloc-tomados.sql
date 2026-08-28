-- Limpiar vacaciones fantasma de Irma Cintia Peloc (legajo 155 / codigo 155)
-- No tiene períodos reales cargados; solo había dias_tomados_previos=4 en vac_saldos.
-- Ejecutar en SQL Editor de Supabase (proyecto uazrrmdngvlwgppdsasc).

UPDATE vac_saldos
SET dias_tomados_previos = 0,
    updated_at = now()
WHERE empleado_id = '72f9ec83-713e-4dea-88c7-04a5c3bd8017';

DELETE FROM vac_solicitudes
WHERE empleado_id = '72f9ec83-713e-4dea-88c7-04a5c3bd8017';

DELETE FROM vac_hist_solicitudes
WHERE codigo = '155';
