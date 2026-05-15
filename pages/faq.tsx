import type { GetStaticProps } from "next";
import type { DehydratedState } from "@tanstack/react-query";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import FAQPage from "@/pages/FAQPage";

type Props = {
  dehydratedState: DehydratedState;
};

export const getStaticProps: GetStaticProps<Props> = async () => {
  const queryClient = new QueryClient();

  return {
    props: {
      dehydratedState: dehydrate(queryClient),
    },
    revalidate: 86400,
  };
};

export default function FAQPageWrapper({ dehydratedState }: Props) {
  return (
    <HydrationBoundary state={dehydratedState}>
      <FAQPage />
    </HydrationBoundary>
  );
}