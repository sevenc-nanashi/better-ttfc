import { baseLogger } from "./logger.ts";

const modLogger = baseLogger.withTag("xhrHook");

type PatchedXMLHttpRequest = {
  bttfcHooked?: boolean;
} & typeof XMLHttpRequest;
type PatchedXMLHttpRequestInstance = {
  method: string | undefined;
  url: string | undefined;
  headers: Record<string, string>;
  readyState: number | undefined;
  status: number | undefined;
  statusText: string | undefined;
  response: Uint8Array | undefined;
  responseUrl?: string | undefined;
};

export type XhrHook = (xhr: Request) => (() => Promise<Response>) | undefined;
const hooks = new Map<string, XhrHook>();
const patchXhrKey = "bttfcXhrPatch";
const getPatchedXMLHttpRequest = (xhr: XMLHttpRequest) => {
  const xhrInstance = xhr as unknown as {
    [patchXhrKey]: PatchedXMLHttpRequestInstance;
  };
  if (!xhrInstance[patchXhrKey]) {
    xhrInstance[patchXhrKey] = {
      method: undefined,
      url: undefined,
      headers: {},
      readyState: undefined,
      status: undefined,
      statusText: undefined,
      response: undefined,
      responseUrl: undefined,
    };
  }
  return xhrInstance[patchXhrKey];
};

function hookXhrIfNeeded() {
  const xhr = XMLHttpRequest as PatchedXMLHttpRequest;
  if (xhr.bttfcHooked) {
    modLogger.warn("XMLHttpRequest is already hooked, skipping.");
    return;
  }

  modLogger.log("Hooking XMLHttpRequest");
  xhr.bttfcHooked = true;
  patchGetter(xhr.prototype, "readyState", (thisArg, getOriginal) => {
    return getPatchedXMLHttpRequest(thisArg).readyState ?? getOriginal();
  });
  patchGetter(xhr.prototype, "status", (thisArg, getOriginal) => {
    return getPatchedXMLHttpRequest(thisArg).status ?? getOriginal();
  });
  patchGetter(xhr.prototype, "statusText", (thisArg, getOriginal) => {
    return getPatchedXMLHttpRequest(thisArg).statusText ?? getOriginal();
  });
  patchGetter(xhr.prototype, "response", (thisArg, getOriginal) => {
    return getPatchedXMLHttpRequest(thisArg).response ?? getOriginal();
  });
  patchGetter(xhr.prototype, "responseURL", (thisArg, getOriginal) => {
    return getPatchedXMLHttpRequest(thisArg).responseUrl ?? getOriginal();
  });
  patchGetter(xhr.prototype, "responseText", (thisArg, getOriginal) => {
    if (getPatchedXMLHttpRequest(thisArg).response) {
      return new TextDecoder().decode(
        getPatchedXMLHttpRequest(thisArg).response,
      );
    } else {
      return getOriginal();
    }
  });

  xhr.prototype.open = new Proxy(xhr.prototype.open, {
    apply: (target, thisArg: XMLHttpRequest, args) => {
      const method = args[0] as string;
      const url = args[1] as string;
      modLogger.log(
        `XMLHttpRequest open called with method: ${method}, url: ${url}`,
      );
      const patch = getPatchedXMLHttpRequest(thisArg);
      patch.method = method;
      patch.url = url;
      patch.headers = {};

      return Reflect.apply(target, thisArg, args);
    },
  });
  xhr.prototype.setRequestHeader = new Proxy(xhr.prototype.setRequestHeader, {
    apply: (target, thisArg, args) => {
      const header = args[0] as string;
      const value = args[1] as string;
      const patch = getPatchedXMLHttpRequest(thisArg);
      patch.headers[header] = value;

      return Reflect.apply(target, thisArg, args);
    },
  });
  xhr.prototype.send = new Proxy(xhr.prototype.send, {
    apply: async (target, thisArg: XMLHttpRequest, args) => {
      const patch = getPatchedXMLHttpRequest(thisArg);

      const request = xhrToRequest(patch);
      for (const [name, hook] of hooks) {
        modLogger.log(`Calling hook "${name}"`);
        const responseCallback = hook(request);
        if (responseCallback) {
          modLogger.log(`Hook "${name}" is overriding the request.`);
          startXhrWithResponseCallback(thisArg, responseCallback);
          return;
        } else {
          modLogger.log(`Hook "${name}" did not return a response.`);
        }
      }

      modLogger.log(
        "No hooks returned a response, proceeding with original send.",
      );
      return Reflect.apply(target, thisArg, args);
    },
  });
}

function patchGetter<T, P extends keyof T>(
  obj: T,
  prop: P,
  getter: (thisArg: T, target: () => T[P]) => T[P] | undefined,
): void {
  const originalDescriptor = Object.getOwnPropertyDescriptor(obj, prop);
  if (!originalDescriptor?.get) {
    throw new Error(`Property "${String(prop)}" does not have a getter.`);
  }
  Object.defineProperty(obj, prop, {
    get() {
      const target = originalDescriptor.get;
      if (target) {
        return getter(this, target.bind(this));
      } else {
        modLogger.warn(`Property "${String(prop)}" does not have a getter.`);
        return undefined;
      }
    },
  });
}

function xhrToRequest(
  patch: PatchedXMLHttpRequestInstance,
  body?: BodyInit | null,
): Request {
  const url = new URL(patch.url || "", location.origin);
  const headers = new Headers();
  for (const [key, value] of Object.entries(patch.headers)) {
    headers.append(key, value);
  }
  return new Request(url.toString(), {
    method: patch.method,
    headers,
    body: body ?? null,
  });
}

async function startXhrWithResponseCallback(
  xhr: XMLHttpRequest,
  responseCallback: () => Promise<Response>,
) {
  const patch = getPatchedXMLHttpRequest(xhr);
  patch.readyState = 1; // OPENED
  modLogger.log(
    `Starting XMLHttpRequest with method: ${patch.method}, url: ${patch.url}`,
  );
  xhr.dispatchEvent(new Event("readystatechange"));
  try {
    const response = await responseCallback();
    patch.readyState = 2; // HEADERS_RECEIVED
    modLogger.log(
      `XMLHttpRequest received headers with status: ${response.status}`,
    );
    patch.status = response.status;
    patch.statusText = response.statusText;
    xhr.dispatchEvent(new Event("loadstart"));

    const buffer = new Uint8Array(await response.arrayBuffer());
    patch.readyState = 4; // DONE
    patch.response = buffer;
    patch.responseUrl = response.url;
    modLogger.log(`Hook request completed with status: ${response.status}`);
    xhr.dispatchEvent(new Event("load"));
    xhr.dispatchEvent(new Event("readystatechange"));
    xhr.dispatchEvent(new Event("loadend"));
  } catch (error) {
    modLogger.error("XMLHttpRequest failed to start:", error);
    patch.readyState = 4; // DONE
    xhr.dispatchEvent(new Event("error"));
    xhr.dispatchEvent(new Event("readystatechange"));
    return;
  }
}

export function insertXhrHook(name: string, hook: XhrHook) {
  hookXhrIfNeeded();

  if (hooks.has(name)) {
    modLogger.warn(`Hook with name "${name}" already exists, replacing it.`);
  } else {
    modLogger.log(`Inserting hook "${name}"`);
  }
  hooks.set(name, hook);
}
