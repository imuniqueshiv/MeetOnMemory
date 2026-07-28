/**
 * Determines which authentication provider should be used for the current request
 * based on the AUTH_PROVIDER feature flag.
 *
 * @returns {string} 'legacy', 'clerk', or 'dual'
 */
export const getAuthProviderFlag = () => {
  return (process.env.AUTH_PROVIDER || "legacy").toLowerCase();
};
