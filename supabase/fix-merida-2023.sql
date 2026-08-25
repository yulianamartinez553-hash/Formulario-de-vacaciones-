-- Merida Leandro Javier (SA-4 / R3): período 2023
-- Tenía dias_correspondientes=2 y dias_tomados_previos=1 → mostraba 1 pendiente.
-- Solo gozó 1 día (hist/planilla 04/01/2025). Pendiente correcto: 0.
UPDATE vac_saldos
SET dias_correspondientes = 1,
    dias_tomados_previos = 1,
    updated_at = now()
WHERE empleado_id = '968bfa7e-9ecc-4a55-b5a1-dd978e6f6942'
  AND periodo = 2023;
