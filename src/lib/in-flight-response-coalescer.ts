export function createInFlightResponseCoalescer() {
  const inFlightResponses = new Map<string, Promise<Response>>();

  return async function coalesceResponse(
    key: string,
    load: () => Promise<Response>,
  ) {
    let responsePromise = inFlightResponses.get(key);

    if (!responsePromise) {
      responsePromise = load();
      inFlightResponses.set(key, responsePromise);
    }

    try {
      const response = await responsePromise;
      return response.clone();
    } finally {
      if (inFlightResponses.get(key) === responsePromise) {
        inFlightResponses.delete(key);
      }
    }
  };
}
