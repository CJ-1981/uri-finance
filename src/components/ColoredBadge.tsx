import { getOptionColor } from "@/lib/optionColors";

interface ColoredBadgeProps {
  value: string;
  colorKey?: string;
  className?: string;
}

const ColoredBadge = ({ value, colorKey, className = "" }: ColoredBadgeProps) => {
  const color = getOptionColor(colorKey);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${color.bg} ${color.text} ${className}`}>
      {value}
    </span>
  );
};

export default ColoredBadge;
