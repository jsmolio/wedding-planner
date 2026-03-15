interface ProgressBarProps {
  value: number;
  max?: number;
  color?: 'primary' | 'green' | 'yellow' | 'red';
  showLabel?: boolean;
  className?: string;
}

const colors = {
  primary: 'bg-primary-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
};

export function ProgressBar({ value, max = 100, color = 'primary', showLabel = true, className = '' }: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="flex-1 h-2.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colors[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-sm font-medium text-gray-600 min-w-[3rem] text-right">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
}
