import type { GetStaticProps } from "next";
import AISearchPage from "@/pages/AISearchPage";

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 3600,
  };
};

export default AISearchPage;


