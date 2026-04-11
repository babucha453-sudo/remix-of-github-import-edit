import dynamic from "next/dynamic";

const ReviewFunnelPage = dynamic(() => import("@/pages/ReviewFunnelPage"), {
  ssr: false,
});

export default ReviewFunnelPage;


