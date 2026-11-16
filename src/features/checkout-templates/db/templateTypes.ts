/** One line of a saved checkout template. Deliberately smaller than `CartLine`: no price is kept, since prices are always re-read from the live catalog when a template is applied. */
export interface TemplateLine {
  product_id: string;
  quantity_kg: number;
}

export interface CheckoutTemplate {
  id: string;
  organization_id: string;
  name: string;
  tags: string[];
  notes: string;
  lines: TemplateLine[];
  created_at: string;
  last_used_at: string;
}

/** Shape of a `checkout_templates` row before `tags`/`lines_json` are parsed back out. */
export interface CheckoutTemplateRow {
  id: string;
  organization_id: string;
  name: string;
  tags: string;
  notes: string;
  lines_json: string;
  created_at: string;
  last_used_at: string;
}

export interface CreateTemplateInput {
  name: string;
  tags: string[];
  notes: string;
  lines: TemplateLine[];
}

export type UpdateTemplateInput = Partial<CreateTemplateInput>;

export type TemplateSortBy = 'name' | 'recent' | 'created';

export interface TemplateSearchParams {
  term?: string;
  tag?: string;
  sortBy?: TemplateSortBy;
}
