--liquibase formatted sql

--changeset codex:001-baseline-placeholder context:all labels:baseline
--comment Baseline inicial vacio para dejar el proyecto listo para futuras migraciones del esquema MVP.
select 1;
