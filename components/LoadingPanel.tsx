interface LoadingPanelProps {
  title: string;
  description?: string;
  compact?: boolean;
  showSkeleton?: boolean;
}

export default function LoadingPanel({
  title,
  description,
  compact = false,
  showSkeleton = true,
}: Readonly<LoadingPanelProps>) {
  const skeletonRows = compact ? 2 : 4;

  return (
    <div
      className={`mx-auto w-full max-w-5xl rounded-2xl border border-gray-100 bg-white shadow-sm ${compact ? "p-4" : "p-6"}`}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple">
          <svg
            className="h-5 w-5 animate-spin"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            ></path>
          </svg>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {description && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
        </div>
      </div>

      {showSkeleton && (
        <div className="mt-5 space-y-3 animate-pulse">
          {Array.from({ length: skeletonRows }, (_, index) => (
            <div
              key={index}
              className={`h-3 rounded-full bg-gray-100 ${
                index === skeletonRows - 1
                  ? "w-7/12"
                  : index % 2 === 0
                    ? "w-full"
                    : "w-10/12"
              }`}
            ></div>
          ))}
        </div>
      )}
    </div>
  );
}
