import { URL } from "url";
import dns from "dns/promises";
import ipaddr from "ipaddr.js";

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
]);

const isBlockedHostname = (hostname) => {
  const host = hostname.toLowerCase().replace(/\.$/, "");
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local")) return true;
  if (host.endsWith(".internal") || host.endsWith(".intranet")) return true;
  return false;
};

const isPublicAddress = (address) => {
  let addr;
  try {
    addr = ipaddr.parse(address);
  } catch {
    return false;
  }

  // Treat IPv4-mapped IPv6 as the embedded IPv4 address.
  if (addr.kind() === "ipv6" && addr.isIPv4MappedAddress()) {
    addr = addr.toIPv4Address();
  }

  // ipaddr.js marks public routable addresses as "unicast".
  return addr.range() === "unicast";
};

const resolveAllAddresses = async (hostname) => {
  // Prefer resolving every record so a single private answer cannot hide behind
  // a public one (and so DNS changes are visible on every delivery).
  const addresses = new Set();

  try {
    const results = await dns.lookup(hostname, { all: true, verbatim: true });
    for (const entry of results) {
      if (entry?.address) addresses.add(entry.address);
    }
  } catch {
    // Fall through to family-specific resolvers below.
  }

  if (addresses.size === 0) {
    const [v4, v6] = await Promise.allSettled([
      dns.resolve4(hostname),
      dns.resolve6(hostname),
    ]);
    if (v4.status === "fulfilled") {
      for (const address of v4.value) addresses.add(address);
    }
    if (v6.status === "fulfilled") {
      for (const address of v6.value) addresses.add(address);
    }
  }

  return [...addresses];
};

/**
 * Re-resolve and validate a webhook destination URL.
 *
 * Used both at configuration time and immediately before every delivery so
 * DNS rebinding / infrastructure changes cannot silently point at private
 * network targets.
 *
 * @param {string} urlStr
 * @returns {Promise<{
 *   ok: boolean,
 *   reason?: string,
 *   addresses?: string[],
 *   pinnedAddress?: string,
 *   family?: 4 | 6,
 *   parsedUrl?: URL,
 * }>}
 */
export const validateWebhookDestination = async (urlStr) => {
  let parsed;
  try {
    parsed = new URL(urlStr);
  } catch {
    return { ok: false, reason: "Destination URL is not a valid URL." };
  }

  if (parsed.protocol !== "https:") {
    return {
      ok: false,
      reason: "Destination URL must use https://.",
    };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) {
    return { ok: false, reason: "Destination URL is missing a hostname." };
  }

  if (isBlockedHostname(hostname)) {
    return {
      ok: false,
      reason: `Destination hostname '${hostname}' is not allowed.`,
    };
  }

  let addresses;
  try {
    addresses = await resolveAllAddresses(hostname);
  } catch (err) {
    return {
      ok: false,
      reason: `Destination DNS lookup failed: ${err.message}`,
    };
  }

  if (!addresses.length) {
    return {
      ok: false,
      reason: "Destination hostname could not be resolved.",
    };
  }

  const privateHits = addresses.filter((address) => !isPublicAddress(address));
  if (privateHits.length > 0) {
    return {
      ok: false,
      reason: `Destination resolves to a private or local address (${privateHits.join(", ")}).`,
      addresses,
    };
  }

  const pinnedAddress = addresses[0];
  const family = pinnedAddress.includes(":") ? 6 : 4;

  return {
    ok: true,
    addresses,
    pinnedAddress,
    family,
    parsedUrl: parsed,
  };
};

/**
 * Boolean helper for Zod refinements and simple call sites.
 * @param {string} urlStr
 * @returns {Promise<boolean>}
 */
export const isSafeWebhookUrl = async (urlStr) => {
  const result = await validateWebhookDestination(urlStr);
  return result.ok;
};
