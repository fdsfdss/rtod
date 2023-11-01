import Webcam from "react-webcam";
import { useRef, useState, useEffect } from "react";
import { runModelUtils } from "../utils";
import { Tensor } from "onnxruntime-web";

interface WebcamComponentProps {
  modelName: string; // Define the expected properties and their types here
  preprocess: (ctx: CanvasRenderingContext2D) => any; // Adjust the types as needed
  session: any; // Adjust the type for 'session' as needed
  inferenceTime: number; // Adjust the type for 'inferenceTime' as needed
  postprocess: (outputTensor: Tensor, inferenceTime: number, ctx: CanvasRenderingContext2D) => void; // Adjust the types as needed
}

const WebcamComponent: React.FC<WebcamComponentProps> = (props) => {
  const [inferenceTime, setInferenceTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const webcamRef = useRef(null);
  const videoCanvasRef = useRef(null);
  const liveDetection = useRef(false);
  const [facingMode, setFacingMode] = useState("environment");
  const originalSize = useRef([0, 0]);
  const [SSR, setSSR] = useState(true);
  const [videoStream, setVideoStream] = useState(null); // Add this line

  const [selectedCamera, setSelectedCamera] = useState("user"); // "user" for front camera, "environment" for rear camera

  const capture = () => {
    const canvas = videoCanvasRef.current;
    const context = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    if (facingMode === "user") {
      context.setTransform(-1, 0, 0, 1, canvas.width, 0);
    }

    context.drawImage(
      webcamRef.current.video,
      0,
      0,
      canvas.width,
      canvas.height
    );

    if (facingMode === "user") {
      context.setTransform(1, 0, 0, 1, 0, 0);
    }
    return context;
  };

  const runModel = async (ctx) => {
    const data = props.preprocess(ctx);
    let outputTensor;
    let inferenceTime;
    [outputTensor, inferenceTime] = await runModelUtils.runModel(
      props.session,
      data
    );

    props.postprocess(outputTensor, props.inferenceTime, ctx);
    setInferenceTime(inferenceTime);
  };

  const runLiveDetection = async () => {
    if (liveDetection.current) {
      liveDetection.current = false;
      return;
    }
    liveDetection.current = true;
    while (liveDetection.current) {
      const startTime = Date.now();
      const ctx = capture();
      if (!ctx) return;
      await runModel(ctx);
      setTotalTime(Date.now() - startTime);
      await new Promise((resolve) =>
        requestAnimationFrame(() => resolve())
      );
    }
  };

  const processImage = async () => {
    reset();
    const ctx = capture();
    if (!ctx) return;

    // create a copy of the canvas
    const boxCtx = document.createElement("canvas").getContext("2d");
    boxCtx.canvas.width = ctx.canvas.width;
    boxCtx.canvas.height = ctx.canvas.height;
    boxCtx.drawImage(ctx.canvas, 0, 0);

    await runModel(boxCtx);
    ctx.drawImage(
      boxCtx.canvas,
      0,
      0,
      ctx.canvas.width,
      ctx.canvas.height
    );
  };

  const reset = async () => {
    const context = videoCanvasRef.current.getContext("2d");
    context.clearRect(0, 0, originalSize.current[0], originalSize.current[1]);
    liveDetection.current = false;
  };

  const setWebcamCanvasOverlaySize = () => {
    const element = webcamRef.current.video;
    if (!element) return;
    const w = element.offsetWidth;
    const h = element.offsetHeight;
    const cv = videoCanvasRef.current;
    if (!cv) return;
    cv.width = w;
    cv.height = h;
  };

  // close camera when browser tab is minimized
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        liveDetection.current = false;
      }
      // set SSR to true to prevent webcam from loading when tab is not active
      setSSR(document.hidden);
    };
    setSSR(document.hidden);
    document.addEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    const initializeCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: selectedCamera },
          audio: false,
        });
        setVideoStream(stream);
      } catch (error) {
        console.error("Error accessing camera:", error);
      }
    };

    initializeCamera();

    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach((track) => {
          track.stop();
        });
      }
    };
  }, [selectedCamera,videoStream]);

  const switchCamera = async () => {
    if (selectedCamera === "user") {
      setSelectedCamera("environment");
    } else {
      setSelectedCamera("user");
    }

    if (videoStream) {
      videoStream.getTracks().forEach((track) => {
        track.stop();
      });

      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: selectedCamera },
        audio: false,
      });

      setVideoStream(newStream);
    }
  };

  return (
    <div className="flex flex-row flex-wrap justify-evenly align-center w-full">
      <div
        id="webcam-container"
        className="flex items-center justify-center webcam-container"
      >
        <Webcam
          mirrored={facingMode === "user"}
          audio={false}
          ref={webcamRef}
          screenshotFormat="image/jpeg"
          imageSmoothing={true}
          videoConstraints={{
            facingMode: selectedCamera,
          }}
          onLoadedMetadata={() => {
            setWebcamCanvasOverlaySize();
            originalSize.current = [
              webcamRef.current.video.offsetWidth,
              webcamRef.current.video.offsetHeight,
            ];
          }}
          forceScreenshotSourceSize={true}
        />
        <canvas
          id="cv1"
          ref={videoCanvasRef}
          style={{
            position: "absolute",
            zIndex: 10,
            backgroundColor: "rgba(0,0,0,0)",
          }}
        ></canvas>
      </div>
      <div className="flex flex-col justify-center items-center">
        <div className="flex gap-3 flex-row flex-wrap justify-center items-center m-5">
          <div className="flex gap-3 justify-center items-center items-stretch">
            <button
              onClick={processImage}
              className="p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition duration-300 ease-in-out"
            >
              Take a Photo
            </button>
            <button
              onClick={runLiveDetection}
              className={`
              p-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition duration-300 ease-in-out 
              ${liveDetection.current ? "bg-white text-black" : ""}
              `}
            >
              {liveDetection.current ? "Stop" : "Start"} Live Detection
            </button>
            <button
              onClick={switchCamera}
              className="p-3 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition duration-300 ease-in-out"
            >
              Switch Camera
            </button>
            <button
              onClick={reset}
              className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-lg transition duration-300 ease-in-out"
            >
              Reset
            </button>
          </div>
        </div>
        <div>Using {props.modelName}</div>
        <div className="flex gap-3 flex-row flex-wrap justify-between items-center px-5 w-full">
          <div>
            {"Total Time: " + totalTime.toFixed() + "ms"}
            <br />
          </div>
          <div>
            <div>{"Total FPS: " + (1000 / totalTime).toFixed(2) + "fps"}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WebcamComponent;
