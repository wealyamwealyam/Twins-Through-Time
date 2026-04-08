import ErrorLayout from "../components/ErrorLayout";

export default function NotFound() {
  return (
    <ErrorLayout
      code="404"
      title="Page Not Found"
      message="The page you are looking for does not exist or may have been moved."
      primaryAction={{ to: "/", label: "Go Home" }}
      secondaryAction={{ to: "/history", label: "View History" }}
    />
  );
}