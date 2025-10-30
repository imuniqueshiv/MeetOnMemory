import React from "react";
import Navbar from "../components/Navbar";
import Header from "../components/Header";

const Home = () => {
  return (
    <div className="relative min-h-screen bg-[url('/bg_img.png')] bg-cover bg-center">
      {/* Fixed Navbar */}
      <Navbar />

      {/* Main content (Header + Hero) */}
      <div className="flex flex-col items-center justify-center pt-32 pb-10 text-center">
        <Header />
      </div>
    </div>
  );
};

export default Home;
