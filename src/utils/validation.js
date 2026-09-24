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
  if (domain === "localhost" || domain === "127.0.0.1") return domain;
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
    return { ...field, label, value, ...(field.selector ? { selector: normalizeText(field.selector) } : {}) };
  });
  return { ...login, name, submitButton, ...(login.submitSelector ? { submitSelector: normalizeText(login.submitSelector) } : {}), fields };
}

function validateFunction(item) {
  const name = normalizeText(item.name);
  const selectors = Array.isArray(item.selectors)
    ? item.selectors.map(normalizeText).filter(Boolean)
    : [];
  if (!name || selectors.length === 0 || selectors.length > 5)
    throw new ValidationError("Each function needs a name and 1–5 selectors.");
  for (const step of selectors) {
    const explicit = /^(focus|click):\s*(.+)$/i.exec(step);
    const selector = (explicit ? explicit[2] : step).split(/\s+\|\s+/, 2)[0].trim();
    if (!selector || /^(focus|click):\s*$/i.test(step))
      throw new ValidationError("Each function step needs a CSS selector.");
  }
  return { ...item, name, selectors };
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
  const functions = (site.functions ?? []).map(validateFunction);
  if (functions.length > 10) throw new ValidationError("A site can have at most 10 functions.");
  return {
    ...site,
    ...(defaultUrl ? { defaultUrl } : {}),
    name,
    domain,
    headers,
    logins,
    ...(site.functions ? { functions } : {}),
    ...(site.duplicateConfirmSelector ? { duplicateConfirmSelector: normalizeText(site.duplicateConfirmSelector) } : {}),
  };
}

export function validateStore(store) {
  if (!store || store.schemaVersion !== 1 || !Array.isArray(store.sites))
    return { schemaVersion: 1, sites: [] };
  const sites = [];
  for (const site of store.sites) sites.push(validateSite(site, sites));
  return { schemaVersion: 1, sites };
}
