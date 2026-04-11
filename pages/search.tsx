import type { GetStaticProps } from "next";
import { DentistFinderLayout } from "@/components/finder";

export default function SearchPage() {
  return (
    <DentistFinderLayout
      title="Find Dentists Near You"
      description="Search for the best dentists and dental clinics. Compare ratings, reviews, and book appointments."
      showFilters={true}
    />
  );
}

export const getStaticProps: GetStaticProps = async () => {
  return {
    props: {},
    revalidate: 3600,
  };
};