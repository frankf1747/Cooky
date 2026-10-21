-- Run: npx supabase test db
-- Fields the journey map needs: step timers and prep tips (cook coach), recipe images (library).
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into public.recipes (id, title, base_servings, minutes, source_label, image_url)
  values ('rcp_test_tip', 'Test dish', 2, 20, 'test', 'https://example.com/dish.jpg');
select is((select image_url from public.recipes where id = 'rcp_test_tip'), 'https://example.com/dish.jpg', 'a recipe can carry an image');

select lives_ok($$ insert into public.recipe_chunks (id, recipe_id, kind, step_no, label, text, timer_seconds)
                   values ('chk_test_tip_s1', 'rcp_test_tip', 'step', 1, 'Step 1', 'Sear it.', 480) $$, 'a step can carry a timer');
select lives_ok($$ insert into public.recipe_chunks (id, recipe_id, kind, step_no, label, text)
                   values ('chk_test_tip_t1', 'rcp_test_tip', 'tip', 1, 'Tip', 'Slice the garlic while it sears.') $$, 'a prep tip is a chunk kind');
select throws_ok($$ insert into public.recipe_chunks (id, recipe_id, kind, step_no, label, text, timer_seconds)
                    values ('chk_test_tip_s2', 'rcp_test_tip', 'step', 2, 'Step 2', 'x', 0) $$, '23514', null, 'a timer must be positive');
select throws_ok($$ insert into public.recipe_chunks (id, recipe_id, kind, step_no, label, text)
                    values ('chk_test_tip_x', 'rcp_test_tip', 'video', 1, 'x', 'x') $$, '23514', null, 'unknown chunk kinds are refused');

select * from finish();
rollback;
