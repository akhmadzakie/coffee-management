import { get, set } from "idb-keyval";

export interface DetectedDeviceInfo {
  sessionId: string;
  deviceName: string;
  browser: string;
  os: string;
  deviceType: "desktop" | "mobile" | "tablet";
}

async function getSessionIdAsync(): Promise<string> {
  let sessionId = await get("node_session_id");
  if (!sessionId) {
    sessionId = localStorage.getItem("node_session_id");
    if (!sessionId) {
      let newId = "";
      try {
        if (typeof crypto !== "undefined" && crypto.randomUUID)
          newId = crypto.randomUUID();
      } catch (e) {}
      if (!newId)
        newId =
          Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
      sessionId = "sess_" + newId;
    }
    await set("node_session_id", sessionId).catch(() => {});
    localStorage.setItem("node_session_id", sessionId);
  }
  return sessionId;
}

export async function detectDeviceAsync(): Promise<DetectedDeviceInfo> {
  const sessionId = await getSessionIdAsync();
  const ua = navigator.userAgent || "";

  // Detect OS
  let os = "Unknown OS";
  if (/windows phone/i.test(ua)) {
    os = "Windows Phone";
  } else if (/win/i.test(ua)) {
    if (/windows nt 10.0/i.test(ua)) os = "Windows 11/10";
    else if (/windows nt 6.3/i.test(ua)) os = "Windows 8.1";
    else if (/windows nt 6.1/i.test(ua)) os = "Windows 7";
    else os = "Windows";
  } else if (/android/i.test(ua)) {
    os = "Android";
  } else if (/iphone|ipad|ipod/i.test(ua)) {
    os = /ipad/i.test(ua) ? "iPadOS" : "iOS";
  } else if (/mac/i.test(ua)) {
    os = "macOS";
  } else if (/cros/i.test(ua)) {
    os = "Chrome OS";
  } else if (/linux/i.test(ua)) {
    os = "Linux";
  }

  // Detect Browser
  let browser = "Web Browser";
  if (/edg/i.test(ua)) {
    browser = "Microsoft Edge";
  } else if (/opr\//i.test(ua) || /opera/i.test(ua)) {
    browser = "Opera";
  } else if (/chrome|crios/i.test(ua) && !/edg/i.test(ua)) {
    browser = "Google Chrome";
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    browser = "Apple Safari";
  } else if (/firefox|fxios/i.test(ua)) {
    browser = "Mozilla Firefox";
  }

  // Detect Device Type
  let deviceType: "desktop" | "mobile" | "tablet" = "desktop";
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    deviceType = "tablet";
  } else if (
    /Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|NetFront|Silk-Accelerated|(hpw|web)OS|Fennec|Minimo|Opera M(obi|ini)|Blazer|Dolfin|Dolphin|Skyfire|Zune/i.test(
      ua,
    )
  ) {
    deviceType = "mobile";
  }

  const deviceName = `${browser} on ${os}`;
  return {
    sessionId,
    deviceName,
    browser,
    os,
    deviceType,
  };
}
