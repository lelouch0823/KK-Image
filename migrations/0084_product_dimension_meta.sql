-- Migration: 0047_product_dimension_meta.sql
-- Description: Add meta column to product_dimension_values for extending dimension attributes like color hex codes.

ALTER TABLE product_dimension_values ADD COLUMN meta TEXT;
