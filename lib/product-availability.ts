export type AvailabilityMode = 'standard' | 'preorder';

export function getAvailabilityMode(product: {
  availability_mode?: string | null;
  metadata?: { availability_mode?: string } | null;
}): AvailabilityMode {
  const mode = product.availability_mode || product.metadata?.availability_mode;
  return mode === 'preorder' ? 'preorder' : 'standard';
}

export function getPreorderLeadHours(product: {
  preorder_lead_hours?: number | null;
  metadata?: { preorder_lead_hours?: number } | null;
}): number {
  const hours = product.preorder_lead_hours ?? product.metadata?.preorder_lead_hours;
  return typeof hours === 'number' && hours > 0 ? hours : 24;
}

export function getAvailableDays(product: {
  available_days?: string[] | null;
  metadata?: { available_days?: string[] } | null;
}): string[] {
  // Prefer the top-level column when it has entries; otherwise fall back to the
  // legacy metadata copy. This keeps older dishes (saved before the column
  // existed) working alongside the Saturday Menu admin page.
  const column = Array.isArray(product.available_days) ? product.available_days : [];
  const meta = Array.isArray(product.metadata?.available_days) ? product.metadata!.available_days! : [];
  const days = column.length > 0 ? column : meta;
  return days.map((d) => d.toLowerCase());
}

export function isSaturdayOnly(product: {
  available_days?: string[] | null;
  metadata?: { available_days?: string[] } | null;
  categories?: { slug?: string; name?: string } | { slug?: string; name?: string }[] | null;
}): boolean {
  const days = getAvailableDays(product);
  if (days.includes('saturday') && days.length === 1) return true;
  const cat = Array.isArray(product.categories) ? product.categories[0] : product.categories;
  return cat?.slug === 'saturday-menu';
}

export function isProductAvailableToday(product: {
  available_days?: string[] | null;
  metadata?: { available_days?: string[] } | null;
  categories?: { slug?: string } | { slug?: string }[] | null;
}): boolean {
  const days = getAvailableDays(product);
  if (days.length === 0) return true;
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Edmonton' }));
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = dayNames[now.getDay()];
  return days.includes(today);
}

export function getProductVideos(product: {
  metadata?: { videos?: string[] } | null;
  product_images?: { url: string; media_type?: string }[] | null;
}): string[] {
  const fromMeta = product.metadata?.videos || [];
  const fromImages =
    product.product_images
      ?.filter((i) => i.media_type === 'video')
      .map((i) => i.url) || [];
  return [...new Set([...fromMeta, ...fromImages])];
}

export function offersProteinChoice(product: {
  metadata?: { offers_protein?: boolean } | null;
}): boolean {
  return product.metadata?.offers_protein === true;
}

export function formatPreorderNotice(hours: number): string {
  if (hours >= 24 && hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? '24 hours notice required' : `${days} days notice required`;
  }
  return `${hours} hours notice required`;
}
