import type { GetStaticProps } from "next";
import SitemapPage from "@/pages/SitemapPage";

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 3600,
  };
};

export default SitemapPage;


