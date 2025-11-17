const compressData = async (data: unknown): Promise<string> => {
  const json = JSON.stringify(data);
  const encoder = new TextEncoder();
  const buffer = encoder.encode(json);
  const compressedStream = new ReadableStream({
    start(controller) {
      controller.enqueue(buffer);
      controller.close();
    },
  }).pipeThrough(new CompressionStream("gzip"));
  const reader = compressedStream.getReader();
  const chunks: Uint8Array[] = [];
  let result = await reader.read();
  while (!result.done) {
    chunks.push(result.value);
    result = await reader.read();
  }
  const compressed = new Uint8Array(
    chunks.reduce((acc, chunk) => acc + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    compressed.set(chunk, offset);
    offset += chunk.length;
  }
  return btoa(String.fromCharCode(...compressed));
};

const decompressData = async (compressed: string): Promise<unknown> => {
  const binaryString = atob(compressed);
  const buffer = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    buffer[i] = binaryString.charCodeAt(i);
  }
  const decompressedStream = new ReadableStream({
    start(controller) {
      controller.enqueue(buffer);
      controller.close();
    },
  }).pipeThrough(new DecompressionStream("gzip"));
  const reader = decompressedStream.getReader();
  const chunks: Uint8Array[] = [];
  let result = await reader.read();
  while (!result.done) {
    chunks.push(result.value);
    result = await reader.read();
  }
  const decompressed = new Uint8Array(
    chunks.reduce((acc, chunk) => acc + chunk.length, 0),
  );
  let offset = 0;
  for (const chunk of chunks) {
    decompressed.set(chunk, offset);
    offset += chunk.length;
  }
  const decoder = new TextDecoder();
  const json = decoder.decode(decompressed);
  return JSON.parse(json);
};

export const getDataFromUrl = async (): Promise<unknown> => {
  const params = new URLSearchParams(window.location.search);
  const dataParam = params.get("data");

  if (!dataParam) {
    return null;
  }
  try {
    return await decompressData(dataParam);
  } catch (error) {
    console.error("Failed to parse data from URL:", error);
    return null;
  }
};

export const setDataInUrl = async (data: unknown): Promise<void> => {
  try {
    const compressed = await compressData(data);
    const params = new URLSearchParams(window.location.search);
    params.set("data", compressed);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", newUrl);
  } catch (error) {
    console.error("Failed to compress data for URL:", error);
  }
};
