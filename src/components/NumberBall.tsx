"use client";

interface NumberBallProps {
  number: number;
  size?: "sm" | "md" | "lg";
  variant?: "default" | "hot" | "cold" | "bonus" | "overdue";
  showCount?: boolean;
  count?: number;
}

function getBallColor(number: number): string {
  if (number <= 10) return "bg-yellow-400 text-yellow-900";
  if (number <= 20) return "bg-blue-500 text-white";
  if (number <= 30) return "bg-red-500 text-white";
  if (number <= 40) return "bg-gray-500 text-white";
  return "bg-green-500 text-white";
}

const sizeClasses = {
  sm: "w-8 h-8 text-xs",
  md: "w-11 h-11 text-sm",
  lg: "w-14 h-14 text-base",
};

export default function NumberBall({
  number,
  size = "md",
  variant = "default",
  showCount,
  count,
}: NumberBallProps) {
  const base = getBallColor(number);
  const variantRing =
    variant === "hot"
      ? "ring-2 ring-orange-400 ring-offset-1 shadow-orange-200 shadow-md"
      : variant === "cold"
      ? "ring-2 ring-sky-300 ring-offset-1 shadow-sky-100 shadow-md"
      : variant === "overdue"
      ? "ring-2 ring-purple-400 ring-offset-1 shadow-purple-200 shadow-md"
      : variant === "bonus"
      ? "ring-2 ring-gray-400 ring-offset-1"
      : "";

  return (
    <div className="flex flex-col items-center gap-0.5">
      <div
        className={`${sizeClasses[size]} ${base} ${variantRing} rounded-full flex items-center justify-center font-bold shadow-sm select-none`}
      >
        {number}
      </div>
      {showCount && count !== undefined && (
        <span className="text-[10px] text-gray-500">{count}회</span>
      )}
    </div>
  );
}
