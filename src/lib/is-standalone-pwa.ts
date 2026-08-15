export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const navigatorWithStandalone = window.navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    navigatorWithStandalone.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function isIOS(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" &&
      window.navigator.maxTouchPoints > 1)
  );
}

export function toSafariSchemeUrl(httpsUrl: string): string {
  if (httpsUrl.startsWith("https://")) {
    return httpsUrl.replace(/^https:\/\//, "x-safari-https://");
  }

  if (httpsUrl.startsWith("http://")) {
    return httpsUrl.replace(/^http:\/\//, "x-safari-http://");
  }

  return httpsUrl;
}

export function shouldUseSafariHandoffFlow(): boolean {
  return isStandalonePwa() && isIOS();
}

export function isIOSSafariBrowser(): boolean {
  return isIOS() && !isStandalonePwa();
}
