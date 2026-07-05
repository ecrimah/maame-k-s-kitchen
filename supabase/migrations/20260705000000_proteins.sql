-- Protein options that customers can choose when ordering a dish.
-- Managed by admin at /admin/proteins and shown on dishes that opt in
-- (products.metadata.offers_protein = true).

CREATE TABLE IF NOT EXISTS public.proteins (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  description text,
  price_delta numeric(10,2) NOT NULL DEFAULT 0,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.proteins IS 'Choosable protein options (e.g. Chicken, Beef, Fish) shown on dishes that opt in';
COMMENT ON COLUMN public.proteins.price_delta IS 'Extra amount added to the dish price when this protein is chosen (0 = no extra charge)';

ALTER TABLE public.proteins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public view active proteins" ON public.proteins;
CREATE POLICY "Public view active proteins" ON public.proteins
  FOR SELECT USING (is_active = true OR is_admin_or_staff());

DROP POLICY IF EXISTS "Staff manage proteins" ON public.proteins;
CREATE POLICY "Staff manage proteins" ON public.proteins
  FOR ALL USING (is_admin_or_staff()) WITH CHECK (is_admin_or_staff());

CREATE INDEX IF NOT EXISTS proteins_active_position_idx
  ON public.proteins (is_active, position);
