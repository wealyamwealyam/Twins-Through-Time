import { useLocation } from "react-router-dom";
import ErrorLayout from "../components/ErrorLayout";

export default function ServerError() {
  const location = useLocation();

  const message =
    location.state?.message ||
    "Something went wrong while connecting to the server. Please try again in a moment.";

  return (
    <ErrorLayout
      code="500"
      title="Server Error"
      message={message}
      primaryAction={{ to: "/", label: "Back to Home" }}
      secondaryAction={{ to: "/upload", label: "Try Another Page" }}
    />
  );
}