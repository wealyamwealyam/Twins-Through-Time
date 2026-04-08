import { useLocation } from "react-router-dom";
import ErrorLayout from "../components/ErrorLayout";

export default function AuthError() {
  const location = useLocation();
  const reason = location.state?.reason;

  let code = "401";
  let title = "Authentication Required";
  let message =
    "Your session may have expired, or you need to log in to access this page.";

  if (reason === "expired") {
    title = "Session Expired";
    message = "Your session has expired. Please log in again to continue.";
  }

  if (reason === "forbidden") {
    code = "403";
    title = "Access Denied";
    message =
      "You are logged in, but you do not have permission to access this page.";
  }

  return (
    <ErrorLayout
      code={code}
      title={title}
      message={message}
      primaryAction={{ to: "/login", label: "Go to Login" }}
      secondaryAction={{ to: "/", label: "Back to Home" }}
    />
  );
}