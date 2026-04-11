import type { GetStaticProps } from "next";
import BlogPage from "@/pages/BlogPage";

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 3600,
  };
};

export default BlogPage;


