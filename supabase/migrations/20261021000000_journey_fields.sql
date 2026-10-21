-- Fields the journey map needs (docs/ROLES.md):
--   recipes.image_url          library cards (Recipes & Cook; optional, https only)
--   recipe_chunks 'tip' kind   prep-while-you-wait tips for the cooking coach
--   recipe_chunks.timer_seconds step timers in cook mode
-- Plan requests carry picked recipes in plan_versions.inputs (jsonb): no column needed.

alter table public.recipes
  add column image_url text check (image_url ~ '^https://');

alter table public.recipe_chunks drop constraint recipe_chunks_kind_check;
alter table public.recipe_chunks
  add constraint recipe_chunks_kind_check check (kind in ('step', 'faq', 'tip'));

alter table public.recipe_chunks
  add column timer_seconds integer check (timer_seconds > 0);
