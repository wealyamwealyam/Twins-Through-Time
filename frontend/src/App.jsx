import { BrowserRouter, Routes, Route } from "react-router-dom";

import Navbar from "./components/Navbar";
import Footer from "./components/Footer";

import { Home } from "./pages/Home";
import Upload from "./pages/Upload";
import History from "./pages/History";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AdminDashboard from "./pages/AdminDashboard";
import AdminUsers from "./pages/AdminUsers";
import AdminReview from "./pages/AdminReview";
import AdminOnboarding from "./pages/AdminOnboarding";

import AuthError from "./pages/AuthError";
import ServerError from "./pages/ServerError";
import NotFound from "./pages/NotFound";

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <div className="min-h-screen flex flex-col">
        <Navbar />

        <main className="flex-grow p-6 bg-gray-100">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/history" element={<History />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/review" element={<AdminReview />} />
            <Route path="/admin/onboarding" element={<AdminOnboarding />} />

            <Route path="/error/auth" element={<AuthError />} />
            <Route path="/error/server" element={<ServerError />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;