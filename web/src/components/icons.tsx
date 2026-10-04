import React from 'react'
import {
  Utensils,
  TrainFront,
  Car,
  Zap,
  Smartphone,
  ShoppingBag,
  Lightbulb,
  Gamepad2,
  Sparkles,
  Pill,
  BookOpen,
  PawPrint,
  Plane,
  HeartHandshake,
  ShieldCheck,
  Package,
  Banknote,
  Gift,
  TrendingUp,
  Briefcase,
  Landmark,
  Heart,
  Recycle,
  CreditCard,
  ArrowLeftRight,
  Coins,
  HandCoins,
  FileText,
  Target,
  Home,
  Gem,
  Laptop,
  Baby,
  GraduationCap,
  HeartPulse,
  Palmtree,
  Backpack,
  Palette,
  LucideIcon,
} from 'lucide-react'

export const CATEGORY_ICON_COMPONENTS: Record<string, LucideIcon> = {
  // 支出分類 (16)
  '餐飲': Utensils,
  '交通': TrainFront,
  '汽機車輛': Car,
  '居家水電': Zap,
  '數位訂閱': Smartphone,
  '購物': ShoppingBag,
  '生活': Lightbulb,
  '娛樂': Gamepad2,
  '美妝保養': Sparkles,
  '醫療': Pill,
  '教育': BookOpen,
  '寵物毛孩': PawPrint,
  '旅行度假': Plane,
  '社交人情': HeartHandshake,
  '保險稅費': ShieldCheck,
  '其他': Package,
  // 收入分類 (7)
  '薪資': Banknote,
  '獎金': Gift,
  '投資': TrendingUp,
  '兼職': Briefcase,
  '政府補貼': Landmark,
  '禮金餽贈': Heart,
  '二手出清': Recycle,
  // 系統內部平帳分類 (4)
  '信用卡還款': CreditCard,
  '內部轉帳': ArrowLeftRight,
  'ATM提款': Coins,
  '公帳代墊報銷': HandCoins,
}

export interface CategoryIconProps {
  category: string
  size?: number
  className?: string
  style?: React.CSSProperties
}

export function CategoryIcon({ category, size = 18, className, style }: CategoryIconProps) {
  const IconComponent = CATEGORY_ICON_COMPONENTS[category] || FileText
  return <IconComponent size={size} className={className} style={style} />
}

export const GOAL_ICON_PRESETS = [
  'target',
  'plane',
  'home',
  'car',
  'gem',
  'laptop',
  'baby',
  'graduation-cap',
  'heart-pulse',
  'palmtree',
  'backpack',
  'palette',
] as const

export type GoalIconKey = (typeof GOAL_ICON_PRESETS)[number]

export const GOAL_ICON_COMPONENTS: Record<GoalIconKey, LucideIcon> = {
  'target': Target,
  'plane': Plane,
  'home': Home,
  'car': Car,
  'gem': Gem,
  'laptop': Laptop,
  'baby': Baby,
  'graduation-cap': GraduationCap,
  'heart-pulse': HeartPulse,
  'palmtree': Palmtree,
  'backpack': Backpack,
  'palette': Palette,
}

const LEGACY_GOAL_EMOJI_TO_KEY: Record<string, GoalIconKey> = {
  '\u{1F3AF}': 'target',
  '\u2708\uFE0F': 'plane',
  '\u2708': 'plane',
  '\u{1F3E0}': 'home',
  '\u{1F697}': 'car',
  '\u{1F48D}': 'gem',
  '\u{1F4BB}': 'laptop',
  '\u{1F476}': 'baby',
  '\u{1F393}': 'graduation-cap',
  '\u{1F3E5}': 'heart-pulse',
  '\u{1F3D6}\uFE0F': 'palmtree',
  '\u{1F3D6}': 'palmtree',
  '\u{1F3DD}\uFE0F': 'palmtree',
  '\u{1F3DD}': 'palmtree',
  '\u{1F334}': 'palmtree',
  '\u{1F392}': 'backpack',
  '\u{1F45C}': 'backpack',
  '\u{1F3A8}': 'palette',
}

export function normalizeGoalIconKey(raw?: string): GoalIconKey {
  if (!raw) return 'target'
  if ((GOAL_ICON_PRESETS as readonly string[]).includes(raw)) {
    return raw as GoalIconKey
  }
  return LEGACY_GOAL_EMOJI_TO_KEY[raw] || 'target'
}

export interface GoalIconProps {
  name?: string
  size?: number
  className?: string
  style?: React.CSSProperties
}

export function GoalIcon({ name, size = 18, className, style }: GoalIconProps) {
  const key = normalizeGoalIconKey(name)
  const IconComponent = GOAL_ICON_COMPONENTS[key] || Target
  return <IconComponent size={size} className={className} style={style} />
}
