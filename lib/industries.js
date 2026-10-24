/**
 * Industry taxonomy - mirror of backend/src/config/industries.js (a test compares the two lists).
 *
 * business_type (how the business operates), industry (this list) and sub_industry (the specific kind of business, e.g. "eye
 * hospital") are three different fields; one is never stored in place of another.
 */
export const INDUSTRIES = Object.freeze([
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'education', label: 'Education' },
  { value: 'technology', label: 'Technology & software' },
  { value: 'finance', label: 'Finance & insurance' },
  { value: 'professional_services', label: 'Professional services' },
  { value: 'marketing_advertising', label: 'Marketing & advertising' },
  { value: 'legal', label: 'Legal' },
  { value: 'retail_ecommerce', label: 'Retail & e-commerce' },
  { value: 'hospitality_food', label: 'Hospitality & food' },
  { value: 'travel_tourism', label: 'Travel & tourism' },
  { value: 'real_estate_construction', label: 'Real estate & construction' },
  { value: 'home_services', label: 'Home services' },
  { value: 'beauty_wellness', label: 'Beauty & wellness' },
  { value: 'automotive', label: 'Automotive' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'other', label: 'Other' },
])

export const industryLabel = (value) => INDUSTRIES.find((i) => i.value === value)?.label || null
