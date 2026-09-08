const HEADER_NAME = /^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/;

export class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
  }
}

export function normalizeText(value) {
  return String(value ?? "").trim();
}

export function normalizeDomain(value) {
  const domain = normalizeText(value).toLowerCase();
  if (
    !domain ||
    domain.includes("://") ||
    domain.includes("/") ||
    domain.includes("*") ||
    domain.includes(" ") ||
    domain.includes(":")
  ) {
    throw new ValidationError(
      "Domain must be an exact hostname without a scheme, port, path, or wildcard.",
    );
  }
  if (
    !/^(?=.{1,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(
      domain,
    )
  ) {
    throw new ValidationError("Domain must be a valid hostname.");
  }
  return domain;
}

export function normalizeDefaultUrl(value, domain) {
  const defaultUrl = normalizeText(value);
  if (!defaultUrl) return undefined;
  let url;
  try {
    url = new URL(defaultUrl);
  } catch {
    throw new ValidationError("Default URL must be a valid http or https URL.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    url.hostname.toLowerCase() !== domain ||
    url.username ||
    url.password
  ) {
    throw new ValidationError(
      "Default URL must use http or https and match the exact site domain.",
    );
  }
  return url.href;
}

export function originPatterns(domain) {
  const exactDomain = normalizeDomain(domain);
  return [`https://${exactDomain}/*`, `http://${exactDomain}/*`];
}

export function validateHeader(header) {
  const key = normalizeText(header.key);
  const value = String(header.value ?? "");
  if (!HEADER_NAME.test(key))
    throw new ValidationError("Header name contains unsupported characters.");
  if (!value || /[\r\n]/.test(value))
    throw new ValidationError(
      "Header value must not be empty or contain line breaks.",
    );
  return { ...header, key, value, enabled: header.enabled !== false };
}

export function validateLogin(login) {
  const name = normalizeText(login.name);
  const submitButton = normalizeText(login.submitButton);
  if (!name) throw new ValidationError("Login profile name is required.");
  if (!submitButton)
    throw new ValidationError("Submit button label is required.");
  if (!Array.isArray(login.fields) || login.fields.length === 0)
    throw new ValidationError("At least one login field is required.");
  const fields = login.fields.map((field) => {
    const label = normalizeText(field.label);
    const value = String(field.value ?? "");
    if (!label || !value)
      throw new ValidationError("Every login field needs a label and value.");
    return { ...field, label, value };
  });
  return { ...login, name, submitButton, fields };
}

export function validateSite(site, existingSites = []) {
  const name = normalizeText(site.name);
  const domain = normalizeDomain(site.domain);
  const defaultUrl = normalizeDefaultUrl(site.defaultUrl, domain);
  if (!name) throw new ValidationError("Site name is required.");
  if (
    existingSites.some(
      (candidate) => candidate.id !== site.id && candidate.domain === domain,
    )
  ) {
    throw new ValidationError("A site with this exact domain already exists.");
  }
  const headers = (site.headers ?? []).map(validateHeader);
  const logins = (site.logins ?? []).map(validateLogin);
  return {
    ...site,
    ...(defaultUrl ? { defaultUrl } : {}),
    name,
    domain,
    headers,
    logins,
  };
}

export function validateStore(store) {
  if (!store || store.schemaVersion !== 1 || !Array.isArray(store.sites))
    return { schemaVersion: 1, sites: [] };
  const sites = [];
  for (const site of store.sites) sites.push(validateSite(site, sites));
  return { schemaVersion: 1, sites };
}
