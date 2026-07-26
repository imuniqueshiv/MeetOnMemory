import React, { createContext, useMemo } from "react";
import { hasPermission, getRolePermissions } from "../utils/rbacPermissions.js";

const RBACContext = createContext(null);

export const RBACProvider = ({ children, userRole }) => {
  const value = useMemo(() => {
    return {
      userRole,
      hasPermission: (resource, action) =>
        hasPermission(userRole, resource, action),
      getPermissions: () => getRolePermissions(userRole),
    };
  }, [userRole]);

  return <RBACContext.Provider value={value}>{children}</RBACContext.Provider>;
};

export default RBACContext;
