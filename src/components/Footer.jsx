import React from "react";

const Footer = () => {
  return (
    <footer className="border-t bg-white mt-auto">
      <div className="text-center mx-auto max-w-6xl px-4 py-4 text-sm text-gray-500">
        © {new Date().getFullYear()} Civil War Photo Sleuth Project
      </div>
    </footer>
  );
};

export default Footer;