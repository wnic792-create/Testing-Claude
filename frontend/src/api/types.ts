export interface Account {
  id: number
  name: string
  type: string
  currency: string
  institution: string | null
  current_balance: number
  interest_rate: number | null
  is_asset: boolean
  notes: string | null
  last_price_update: string | null
  purchase_price: number | null
  purchase_date: string | null
  down_payment: number | null
  appreciation_rate: number | null
  property_tax_annual: number | null
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: number
  account_id: number
  date: string
  description: string
  amount: number
  currency: string
  category_id: number | null
  is_transfer: boolean
  transfer_pair_id: number | null
  is_split: boolean
  parent_tx_id: number | null
  import_hash: string | null
  source_file: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export interface Category {
  id: number
  name: string
  name_fr: string | null
  parent_id: number | null
  icon: string | null
  type: string
  is_system: boolean
  children?: Category[]
}

export interface BankProfile {
  id: string
  name: string
  institution: string
}

export interface ImportResult {
  imported: number
  duplicates_skipped: number
  auto_categorized: number
  filename: string
}

export interface Budget {
  id: number
  category_id: number
  year_month: string
  amount: number
  rollover: boolean
  rollover_amount: number
}

export interface Scenario {
  id: number
  name: string
  description: string | null
  cloned_from_id: number | null
  color: string
  created_at: string
  updated_at: string
}

export interface Goal {
  id: number
  scenario_id: number
  name: string
  target_amount: number | null
  type: string
  months_expenses: number | null
  linked_account_id: number | null
  target_date: string | null
}
