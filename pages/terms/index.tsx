import type { GetStaticProps } from "next";
import TermsPage from "@/pages/TermsPage";

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 3600,
  };
};

export default TermsPage;


