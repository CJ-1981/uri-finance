// Predefined color palette for list-type custom column options
// Colors are stored as keys and rendered as badge styles

export const OPTION_COLOR_PALETTE = [
  { key: "gray", label: "Gray", bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  { key: "red", label: "Red", bg: "bg-red-100 dark:bg-red-950", text: "text-red-700 dark:text-red-300", dot: "bg-red-500" },
  { key: "orange", label: "Orange", bg: "bg-orange-100 dark:bg-orange-950", text: "text-orange-700 dark:text-orange-300", dot: "bg-orange-500" },
  { key: "amber", label: "Amber", bg: "bg-amber-100 dark:bg-amber-950", text: "text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  { key: "green", label: "Green", bg: "bg-green-100 dark:bg-green-950", text: "text-green-700 dark:text-green-300", dot: "bg-green-500" },
  { key: "teal", label: "Teal", bg: "bg-teal-100 dark:bg-teal-950", text: "text-teal-700 dark:text-teal-300", dot: "bg-teal-500" },
  { key: "blue", label: "Blue", bg: "bg-blue-100 dark:bg-blue-950", text: "text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  { key: "indigo", label: "Indigo", bg: "bg-indigo-100 dark:bg-indigo-950", text: "text-indigo-700 dark:text-indigo-300", dot: "bg-indigo-500" },
  { key: "purple", label: "Purple", bg: "bg-purple-100 dark:bg-purple-950", text: "text-purple-700 dark:text-purple-300", dot: "bg-purple-500" },
  { key: "pink", label: "Pink", bg: "bg-pink-100 dark:bg-pink-950", text: "text-pink-700 dark:text-pink-300", dot: "bg-pink-500" },
] as const;

export type OptionColorKey = typeof OPTION_COLOR_PALETTE[number]["key"];

export function getOptionColor(key: string | undefined) {
  return OPTION_COLOR_PALETTE.find((c) => c.key === key) || OPTION_COLOR_PALETTE[0];
}

export function getOptionBadgeClasses(colorKey: string | undefined) {
  const color = getOptionColor(colorKey);
  return `${color.bg} ${color.text}`;
}
