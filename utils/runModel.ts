import { InferenceSession, Tensor } from "onnxruntime-web";

export async function createModelCpu(
  url: string
): Promise<InferenceSession> {
  return await InferenceSession.create(url, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
}

export async function runModel(
  model: InferenceSession | null,  // Update this to reflect that model might be null
  preprocessedData: Tensor
): Promise<[Tensor, number]> {
  if (!model) {
    throw new Error('Model is not loaded'); // Add this check for better error messaging
  }
  
  try {
    const feeds: Record<string, Tensor> = {};
    feeds[model.inputNames[0]] = preprocessedData;
    const start = Date.now();
    const outputData = await model.run(feeds);
    const end = Date.now();
    const inferenceTime = end - start;
    const output = outputData[model.outputNames[0]];
    return [output, inferenceTime];
  } catch (e) {
    console.error(e);
    throw new Error(`Error during model inference: ${e.message}`);
  }
}
