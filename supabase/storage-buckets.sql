insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-images',    'product-images',    true,  5242880,  array['image/jpeg','image/png','image/webp']),
  ('site-media',        'site-media',        true,  20971520, array['video/mp4']),
  ('payment-proofs',    'payment-proofs',    false, 5242880,  array['image/jpeg','image/png','application/pdf']),
  ('verification-docs', 'verification-docs', false, 5242880,  array['image/jpeg','image/png','application/pdf']),
  ('b2b-documents',     'b2b-documents',     false, 5242880,  array['image/jpeg','image/png','application/pdf']),
  ('catalog-imports',   'catalog-imports',   false, 7340032,  array['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'])
on conflict (id) do nothing;

