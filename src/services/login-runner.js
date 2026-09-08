import { LOGIN_DELAY_MS } from "../shared/constants.js";
import { hasSitePermission } from "./permissions.js";
import { isManagerEnabled } from "./manager-state.js";

export function exactText(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

export async function runLoginOnActiveTab(site, login) {
  if (!(await isManagerEnabled()))
    throw new Error("Header Login Manager is disabled.");
  const [tab] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (!tab?.id || !tab.url) throw new Error("No active web page is available.");
  const currentDomain = new URL(tab.url).hostname.toLowerCase();
  if (currentDomain !== site.domain)
    throw new Error(
      `Domain mismatch: current tab is ${currentDomain}, configured site is ${site.domain}.`,
    );
  if (!(await hasSitePermission(site.domain)))
    throw new Error(`Permission for ${site.domain} has not been granted.`);
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: executeLoginProfile,
    args: [login, LOGIN_DELAY_MS],
  });
  const result = results[0]?.result;
  if (!result?.ok)
    throw new Error(
      result?.error ?? "Login automation did not return a result.",
    );
  return result;
}

// This function is intentionally self-contained because Chrome serializes it into the target page.
export async function executeLoginProfile(login, delayMs) {
  const normalize = (value) =>
    String(value ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLocaleLowerCase();
  const sleep = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds));
  const findInputByLabel = (labelText) => {
    const expected = normalize(labelText);
    for (const label of document.querySelectorAll("label")) {
      if (normalize(label.innerText || label.textContent) !== expected)
        continue;
      if (label.htmlFor) {
        const associated = document.getElementById(label.htmlFor);
        if (associated && /^(INPUT|TEXTAREA|SELECT)$/.test(associated.tagName))
          return associated;
      }
      const nested = label.querySelector("input, textarea, select");
      if (nested) return nested;
    }
    return [...document.querySelectorAll("input, textarea, select")].find(
      (input) => normalize(input.getAttribute("aria-label")) === expected,
    );
  };
  const setNativeValue = (input, value) => {
    const prototype =
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : input instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : HTMLInputElement.prototype;
    const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
    if (!descriptor?.set)
      throw new Error("This field does not support a native value setter.");
    descriptor.set.call(input, value);
  };
  const findButton = (buttonText) => {
    const expected = normalize(buttonText);
    for (const button of document.querySelectorAll("button"))
      if (
        !button.disabled &&
        normalize(button.innerText || button.textContent) === expected
      )
        return button;
    for (const input of document.querySelectorAll('input[type="submit"]'))
      if (!input.disabled && normalize(input.value) === expected) return input;
    return [...document.querySelectorAll('button, input[type="submit"]')].find(
      (element) =>
        !element.disabled &&
        normalize(element.getAttribute("aria-label")) === expected,
    );
  };
  try {
    for (const field of login.fields) {
      const input = findInputByLabel(field.label);
      if (!input) throw new Error(`Field not found: ${field.label}`);
      input.focus();
      setNativeValue(input, field.value);
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await sleep(delayMs);
    }
    await sleep(delayMs);
    const button = findButton(login.submitButton);
    if (!button)
      throw new Error(`Submit button not found: ${login.submitButton}`);
    button.click();
    return { ok: true, filledFields: login.fields.length };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
