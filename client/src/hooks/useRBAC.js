import { useContext } from "react";
import RBACContext from "../context/RBACContext.jsx";

export const useRBAC = () => {
  const context = useContext(RBACContext);
  if (!context) {
    throw new Error("useRBAC must be used within a RBACProvider");
  }
  return context;
};
