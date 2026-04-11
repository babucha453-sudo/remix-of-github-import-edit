import dynamic from "next/dynamic";

const ListYourPracticeSuccessPage = dynamic(
  () => import("@/pages/ListYourPracticeSuccessPage"),
  { ssr: false }
);

export default ListYourPracticeSuccessPage;


