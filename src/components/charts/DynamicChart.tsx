import dynamic from "next/dynamic";

export const DynamicChart = dynamic(
  () => import("@/components/ui/chart"),
  {
    ssr: false,
    loading: () => (
      <div className="flex aspect-video items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    ),
  }
);