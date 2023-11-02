import { InferenceSession, Tensor } from "onnxruntime-web";

export async function createModelCpu(url: string): Promise<InferenceSession> {
  return InferenceSession.create(url, {
    executionProviders: ["wasm"],
    graphOptimizationLevel: "all",
  });
}

export async function runModel(
  model: InferenceSession,
  preprocessedData: Tensor
): Promise<[Tensor, number]> {
  const feeds: Record<string, Tensor> = {};
  feeds[model.inputNames[0]] = preprocessedData;
  const start = Date.now();
  const outputData = await model.run(feeds);
  const end = Date.now();
  const inferenceTime = end - start;
  const output = outputData[model.outputNames[0]];
  return [output, inferenceTime];
}

// This function ensures that the model is loaded before running it
export async function loadAndRunModel(
  url: string,
  preprocessedData: Tensor
): Promise<[Tensor, number]> {
  try {
    // First, create the model instance
    const model = await createModelCpu(url);

    // Then, run the model with the preprocessed data
    return runModel(model, preprocessedData);
  } catch (error) {
    console.error(error);
    throw new Error(`Failed to load or run model: ${error.message}`);
  }
}